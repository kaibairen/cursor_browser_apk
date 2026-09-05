import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openRunStream } from '../../lib/cursor/sse';
import { applySseEvent, applySseEvents, ensureThinkingLine, type TranscriptLine } from '../../lib/cursor/sseApply';
import { prepareBurst, replayDelayMs } from '../../lib/cursor/ssePace';
import type { SseEvent } from '../../lib/cursor/sseParse';
import { CursorApiError, isNetworkError } from '../../lib/cursor/errors';
import { isNetworkDown, networkBackoffMs, noteNetworkFail } from '../../lib/cursor/reconnect';
import { isTerminalRun, type Run, type RunStatus } from '../../lib/cursor/types';
import { useAuth, useOptionalApiKey } from '../auth/AuthContext';

export type { TranscriptLine };

const LIVE_RETRY_MS = [80, 160, 280, 450, 700];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useRunStream(agentId: string, runId: string | undefined, runStatus?: RunStatus) {
  const apiKey = useOptionalApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  const [ended, setEnded] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const linesRef = useRef<TranscriptLine[]>([]);
  const lastEventId = useRef<string | undefined>(undefined);
  const simplified = useRef({ assistant: false, thinking: false });
  const pendingRetry = useRef(false);
  const retries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<SseEvent[]>([]);
  const pumping = useRef(false);
  const burstRef = useRef(false);
  const stopped = useRef(false);
  const statusRef = useRef(runStatus);

  statusRef.current = runStatus;
  const runDone = Boolean(runStatus && isTerminalRun(runStatus));
  const live = Boolean(runId && apiKey && !usePolling && !ended && !runDone);
  const canConnect = Boolean(
    runId && apiKey && !usePolling && !ended && (runStatus === 'CREATING' || runStatus === 'RUNNING'),
  );

  useEffect(() => {
    linesRef.current = [];
    setLines([]);
    setStreamError(null);
    setUsePolling(false);
    setEnded(false);
    setRevealing(false);
    setRetryNonce(0);
    lastEventId.current = undefined;
    simplified.current = { assistant: false, thinking: false };
    pendingRetry.current = false;
    retries.current = 0;
    queueRef.current = [];
    pumping.current = false;
    burstRef.current = false;
    stopped.current = false;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [runId]);

  useEffect(() => {
    if (!runStatus || !isTerminalRun(runStatus)) return;
    stopped.current = true;
    queueRef.current = [];
    burstRef.current = false;
    setRevealing(false);
    setEnded(true);
    void queryClient.invalidateQueries({ queryKey: ['conversation', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['artifacts', agentId] });
    void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
  }, [agentId, queryClient, runStatus]);

  useEffect(() => {
    if (!canConnect || !runId || !apiKey) return;
    stopped.current = false;

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
        onEvent: (event) => enqueue([event], false),
        onEvents: (events) => enqueue(events, events.length > 1),
        onError: (error) => {
          const unavailable = error instanceof CursorApiError && error.code === 'stream_unavailable';
          const status = statusRef.current;
          if (isNetworkError(error)) noteNetworkFail();
          if (unavailable || (isNetworkError(error) && (!status || status === 'CREATING' || status === 'RUNNING'))) {
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

    function context() {
      return {
        lastEventId: lastEventId.current,
        simplified: simplified.current,
        pendingRetry: pendingRetry.current,
      };
    }

    function commit(result: ReturnType<typeof applySseEvent>) {
      lastEventId.current = result.lastEventId;
      pendingRetry.current = Boolean(result.retry);
      linesRef.current = result.lines;
      setLines(result.lines);
      return result;
    }

    function finishTerminal(result: ReturnType<typeof applySseEvent>) {
      retries.current = 0;
      queueRef.current = [];
      burstRef.current = false;
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
      void queryClient.invalidateQueries({ queryKey: ['artifacts', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['runs', agentId] });
    }

    function enqueue(events: SseEvent[], burst: boolean) {
      if (stopped.current || !events.length) return;
      const next = burst || events.length > 1 ? prepareBurst(events) : events;
      if (next.length > 1) {
        const result = commit(applySseEvents(next, linesRef.current, context()));
        if (result.retry) {
          lastEventId.current = undefined;
          pendingRetry.current = false;
          scheduleRetry();
          return;
        }
        if (result.terminal) finishTerminal(result);
        return;
      }
      if (burst) burstRef.current = true;
      queueRef.current.push(...next);
      void pump();
    }

    async function pump() {
      if (pumping.current) return;
      pumping.current = true;
      setRevealing(true);
      let previous: SseEvent | undefined;
      while (queueRef.current.length && !stopped.current) {
        const event = queueRef.current.shift();
        if (!event) break;
        if (burstRef.current) {
          const wait = replayDelayMs(event, previous);
          if (wait > 0) await sleep(wait);
        }
        previous = event;
        const result = commit(applySseEvent(event, linesRef.current, context()));
        if (result.retry) {
          lastEventId.current = undefined;
          pendingRetry.current = false;
          queueRef.current = [];
          burstRef.current = false;
          scheduleRetry();
          break;
        }
        if (result.terminal) {
          finishTerminal(result);
          break;
        }
      }
      if (!queueRef.current.length) burstRef.current = false;
      pumping.current = false;
      if (!queueRef.current.length) setRevealing(false);
    }

    function scheduleRetry() {
      if (retryTimer.current || stopped.current) return;
      const status = statusRef.current;
      if (status && isTerminalRun(status)) {
        setUsePolling(true);
        setStreamError(null);
        return;
      }
      const wait = isNetworkDown()
        ? Math.max(1_000, networkBackoffMs())
        : (LIVE_RETRY_MS[Math.min(retries.current, LIVE_RETRY_MS.length - 1)] ?? 700);
      retries.current += 1;
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
    live: live || revealing,
    stop: () => {
      stopped.current = true;
      queueRef.current = [];
      burstRef.current = false;
      setRevealing(false);
      setEnded(true);
    },
  };
}
