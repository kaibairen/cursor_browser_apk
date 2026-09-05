import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openRunStream } from '../../lib/cursor/sse';
import { applySseEvent, ensureThinkingLine, type TranscriptLine } from '../../lib/cursor/sseApply';
import { CursorApiError } from '../../lib/cursor/errors';
import { isTerminalRun, type Run, type RunStatus } from '../../lib/cursor/types';
import { useAuth, useOptionalApiKey } from '../auth/AuthContext';

export type { TranscriptLine };

const RETRY_MS = [250, 400, 700, 1100, 1800, 2800];

export function useRunStream(agentId: string, runId: string | undefined, runStatus?: RunStatus) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  const [ended, setEnded] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const linesRef = useRef<TranscriptLine[]>([]);
  const lastEventId = useRef<string | undefined>(undefined);
  const simplified = useRef({ assistant: false, thinking: false });
  const retries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = Boolean(
    runId && apiKey && !usePolling && !ended && (!runStatus || !isTerminalRun(runStatus)),
  );
  const canConnect = Boolean(live && runStatus === 'RUNNING');

  useEffect(() => {
    linesRef.current = [];
    setLines([]);
    setStreamError(null);
    setUsePolling(false);
    setEnded(false);
    setRetryNonce(0);
    lastEventId.current = undefined;
    simplified.current = { assistant: false, thinking: false };
    retries.current = 0;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [runId]);

  useEffect(() => {
    if (!canConnect || !runId || !apiKey) return;

    const stop = openRunStream(
      apiKey,
      agentId,
      runId,
      {
        onOpen: () => {
          const next = ensureThinkingLine(linesRef.current);
          linesRef.current = next;
          setLines(next);
        },
        onEvent: (event) => {
          const result = applySseEvent(event, linesRef.current, {
            lastEventId: lastEventId.current,
            simplified: simplified.current,
          });
          lastEventId.current = result.lastEventId;
          linesRef.current = result.lines;
          setLines(result.lines);
          if (result.retry) {
            scheduleRetry();
            return;
          }
          if (!result.terminal) return;
          retries.current = 0;
          setEnded(true);
          queryClient.setQueryData(['run', agentId, runId], (current: Run | undefined) =>
            current
              ? {
                  ...current,
                  status: result.runStatus ?? 'FINISHED',
                  result: result.resultText ?? current.result,
                  durationMs: result.durationMs ?? current.durationMs,
                }
              : current,
          );
          void queryClient.invalidateQueries({ queryKey: ['run', agentId, runId] });
          void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['conversation', agentId] });
        },
        onError: (error) => {
          if (error instanceof CursorApiError && error.code === 'stream_unavailable') {
            scheduleRetry();
            return;
          }
          handleApiError(error);
          if (error instanceof CursorApiError && error.code === 'stream_expired') {
            setUsePolling(true);
            setStreamError('直播已过期，改为轮询状态');
            return;
          }
          setUsePolling(true);
          setStreamError(error.message);
        },
      },
      lastEventId.current,
    );

    return () => {
      stop();
    };

    function scheduleRetry() {
      if (retryTimer.current) return;
      const attempt = retries.current;
      if (attempt >= RETRY_MS.length) {
        setUsePolling(true);
        setStreamError(null);
        return;
      }
      const wait = RETRY_MS[attempt] ?? 2800;
      retries.current = attempt + 1;
      retryTimer.current = setTimeout(() => {
        retryTimer.current = null;
        setRetryNonce((value) => value + 1);
      }, wait);
    }
  }, [apiKey, agentId, runId, canConnect, retryNonce, handleApiError, queryClient]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  return {
    lines,
    streamError,
    usePolling,
    live: live || canConnect,
    stop: () => setEnded(true),
  };
}
