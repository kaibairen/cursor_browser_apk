import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openRunStream } from '../../lib/cursor/sse';
import { applySseEvent, type TranscriptLine } from '../../lib/cursor/sseApply';
import { CursorApiError } from '../../lib/cursor/errors';
import { isTerminalRun, type Run, type RunStatus } from '../../lib/cursor/types';
import { useAuth, useOptionalApiKey } from '../auth/AuthContext';

export type { TranscriptLine };

export function useRunStream(agentId: string, runId: string | undefined, runStatus?: RunStatus) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  const [ended, setEnded] = useState(false);
  const linesRef = useRef<TranscriptLine[]>([]);
  const lastEventId = useRef<string | undefined>(undefined);
  const simplified = useRef({ assistant: false, thinking: false });

  const live = Boolean(
    runId && apiKey && !usePolling && !ended && (!runStatus || !isTerminalRun(runStatus)),
  );

  useEffect(() => {
    linesRef.current = [];
    setLines([]);
    setStreamError(null);
    setUsePolling(false);
    setEnded(false);
    lastEventId.current = undefined;
    simplified.current = { assistant: false, thinking: false };
  }, [runId]);

  useEffect(() => {
    if (!live || !runId || !apiKey) return;

    const stop = openRunStream(
      apiKey,
      agentId,
      runId,
      {
        onEvent: (event) => {
          const result = applySseEvent(event, linesRef.current, {
            lastEventId: lastEventId.current,
            simplified: simplified.current,
          });
          lastEventId.current = result.lastEventId;
          linesRef.current = result.lines;
          setLines(result.lines);
          if (!result.terminal) return;
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

    return stop;
  }, [apiKey, agentId, runId, live, handleApiError, queryClient]);

  return { lines, streamError, usePolling, live };
}
