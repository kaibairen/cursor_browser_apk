import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { openRunStream, type SseEvent } from '../../lib/cursor/sse';
import { CursorApiError } from '../../lib/cursor/errors';
import { isTerminalRun, type RunStatus } from '../../lib/cursor/types';
import { useApiKey, useAuth } from '../auth/AuthContext';

export type TranscriptLine =
  | { kind: 'assistant'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; callId: string; name: string; status: string; detail?: string };

export function useRunStream(agentId: string, runId: string | undefined, runStatus?: RunStatus) {
  const apiKey = useApiKey();
  const { handleApiError } = useAuth();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usePolling, setUsePolling] = useState(false);
  const lastEventId = useRef<string | undefined>(undefined);

  const live = Boolean(runId && runStatus && !isTerminalRun(runStatus) && !usePolling);

  useEffect(() => {
    setLines([]);
    setStreamError(null);
    setUsePolling(false);
    lastEventId.current = undefined;
  }, [runId]);

  useEffect(() => {
    if (!live || !runId) return;

    const stop = openRunStream(
      apiKey,
      agentId,
      runId,
      {
        onEvent: (event) => applySseEvent(event, setLines, lastEventId, () => {
          void queryClient.invalidateQueries({ queryKey: ['run', agentId, runId] });
          void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        }),
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

  return { lines, streamError, usePolling };
}

function applySseEvent(
  event: SseEvent,
  setLines: React.Dispatch<React.SetStateAction<TranscriptLine[]>>,
  lastEventId: { current: string | undefined },
  onTerminal: () => void,
): void {
  if (event.id) lastEventId.current = event.id;
  if (event.event === 'heartbeat' || event.event === 'status') return;

  if (event.event === 'assistant' || event.event === 'thinking') {
    try {
      const payload = JSON.parse(event.data) as { text?: string };
      const text = payload.text ?? '';
      if (!text) return;
      const kind = event.event === 'thinking' ? 'thinking' : 'assistant';
      setLines((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.kind === kind) {
          return [...prev.slice(0, -1), { kind, text: last.text + text }];
        }
        return [...prev, { kind, text }];
      });
    } catch {
      // ignore malformed deltas
    }
    return;
  }

  if (event.event === 'tool_call') {
    try {
      const payload = JSON.parse(event.data) as {
        callId: string;
        name: string;
        status: string;
        args?: unknown;
      };
      setLines((prev) => {
        const existing = prev.findIndex(
          (line) => line.kind === 'tool' && line.callId === payload.callId,
        );
        const next: TranscriptLine = {
          kind: 'tool',
          callId: payload.callId,
          name: payload.name,
          status: payload.status,
          detail: payload.args ? summarizeArgs(payload.args) : undefined,
        };
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = next;
          return copy;
        }
        return [...prev, next];
      });
    } catch {
      // ignore
    }
    return;
  }

  if (event.event === 'result') {
    try {
      const payload = JSON.parse(event.data) as { text?: string };
      if (payload.text) {
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.kind === 'assistant' && last.text === payload.text) {
            return prev;
          }
          return [...prev, { kind: 'assistant', text: payload.text ?? '' }];
        });
      }
    } catch {
      // ignore
    }
    onTerminal();
    return;
  }

  if (event.event === 'done' || event.event === 'error') {
    onTerminal();
  }
}

function summarizeArgs(args: unknown): string {
  try {
    const text = JSON.stringify(args);
    return text.length > 140 ? `${text.slice(0, 137)}...` : text;
  } catch {
    return '';
  }
}
