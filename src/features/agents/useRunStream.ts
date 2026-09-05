import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openRunStream } from '../../lib/cursor/sse';
import { applySseEvent, ensureThinkingLine, type TranscriptLine } from '../../lib/cursor/sseApply';
import { prepareBurst, replayDelayMs, type StreamPhase, eventPhase } from '../../lib/cursor/ssePace';
import type { SseEvent } from '../../lib/cursor/sseParse';
import { CursorApiError } from '../../lib/cursor/errors';
import { isTerminalRun, type Run, type RunStatus } from '../../lib/cursor/types';
import { useAuth, useOptionalApiKey } from '../auth/AuthContext';

export type { TranscriptLine };

const RETRY_MS = [150, 280, 450, 700, 1100, 1600, 2200, 3200];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 16);
  });
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
  const sawActive = useRef(false);
  const queueRef = useRef<SseEvent[]>([]);
  const pumping = useRef(false);
  const burstRef = useRef(false);
  const stopped = useRef(false);
  const statusRef = useRef(runStatus);

  statusRef.current = runStatus;
  const live = Boolean(
    runId && apiKey && !usePolling && !ended && (!runStatus || !isTerminalRun(runStatus)),
  );
  const canReplayFinished = Boolean(sawActive.current && runStatus && isTerminalRun(runStatus) && !ended);
  const canConnect = Boolean(
    runId &&
      apiKey &&
      !usePolling &&
      !ended &&
      (runStatus === 'CREATING' || runStatus === 'RUNNING' || canReplayFinished),
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
    sawActive.current = false;
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
    if (!runStatus || runStatus === 'CREATING' || runStatus === 'RUNNING') {
      sawActive.current = true;
    }
  }, [runStatus]);

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

    function enqueue(events: SseEvent[], burst: boolean) {
      if (stopped.current || !events.length) return;
      const next = burst ? prepareBurst(events) : events;
      if (burst) burstRef.current = true;
      queueRef.current.push(...next);
      void pump();
    }

    function applyOne(event: SseEvent) {
      const ctx = {
        lastEventId: lastEventId.current,
        simplified: simplified.current,
        pendingRetry: pendingRetry.current,
      };
      const result = applySseEvent(event, linesRef.current, ctx);
      lastEventId.current = result.lastEventId;
      pendingRetry.current = Boolean(ctx.pendingRetry);
      linesRef.current = result.lines;
      setLines(result.lines);
      return result;
    }

    async function pump() {
      if (pumping.current) return;
      pumping.current = true;
      setRevealing(true);
      while (queueRef.current.length && !stopped.current) {
        const event = queueRef.current.shift();
        if (!event) break;
        const result = applyOne(event);
        if (result.retry) {
          lastEventId.current = undefined;
          pendingRetry.current = false;
          queueRef.current = [];
          burstRef.current = false;
          scheduleRetry();
          break;
        }
        if (result.terminal) {
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
          break;
        }
        const phase: StreamPhase = eventPhase(event);
        if (burstRef.current) {
          const wait = replayDelayMs(event);
          if (wait > 0) await sleep(wait);
          else if (phase !== 'meta') await nextFrame();
        } else if (queueRef.current.length) {
          await nextFrame();
        }
      }
      if (!queueRef.current.length) burstRef.current = false;
      pumping.current = false;
      if (!queueRef.current.length) setRevealing(false);
    }

    function scheduleRetry() {
      if (retryTimer.current || stopped.current) return;
      const status = statusRef.current;
      const attempt = retries.current;
      if (attempt >= RETRY_MS.length) {
        if (status === 'CREATING' || status === 'RUNNING' || !status) {
          retries.current = RETRY_MS.length - 1;
        } else {
          setUsePolling(true);
          setStreamError(null);
          return;
        }
      }
      const wait = RETRY_MS[Math.min(retries.current, RETRY_MS.length - 1)] ?? 3200;
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
    live: live || revealing || canConnect,
    stop: () => {
      stopped.current = true;
      queueRef.current = [];
      burstRef.current = false;
      setRevealing(false);
      setEnded(true);
    },
  };
}
