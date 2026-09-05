import type { SseEvent } from './sseParse';

export type StreamPhase = 'meta' | 'thinking' | 'assistant' | 'tool' | 'end' | 'retry';

export function readSseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (record.update && typeof record.update === 'object') {
      return { ...record, ...(record.update as Record<string, unknown>) };
    }
    return record;
  } catch {
    return null;
  }
}

export function eventPhase(event: SseEvent): StreamPhase {
  if (event.event === 'heartbeat' || event.event === 'status') return 'meta';
  if (event.event === 'thinking') return 'thinking';
  if (event.event === 'assistant') return 'assistant';
  if (event.event === 'tool_call') return 'tool';
  if (event.event === 'result' || event.event === 'done') return 'end';
  if (event.event === 'error') {
    const payload = readSseJson(event.data);
    return payload?.code === 'stream_unavailable' ? 'retry' : 'end';
  }
  if (event.event === 'interaction_update') {
    const type = String(readSseJson(event.data)?.type ?? '');
    if (type === 'thinking-delta' || type === 'thinking' || type === 'thinking-completed') return 'thinking';
    if (type === 'text-delta' || type === 'assistant') return 'assistant';
    if (type.startsWith('tool-call') || type === 'partial-tool-call') return 'tool';
  }
  return 'meta';
}

export function replayDelayMs(event: SseEvent, previous?: SseEvent): number {
  if (!previous) return 0;
  const from = eventPhase(previous);
  const to = eventPhase(event);
  if (from === 'thinking' && to === 'assistant') return 16;
  return 0;
}

export function prepareBurst(events: SseEvent[]): SseEvent[] {
  const hasThinking = events.some((event) => event.event === 'thinking');
  const hasAssistant = events.some((event) => event.event === 'assistant');
  return events.filter((event) => {
    if (event.event !== 'interaction_update') return true;
    const type = String(readSseJson(event.data)?.type ?? '');
    if (hasThinking && (type === 'thinking-delta' || type === 'thinking')) return false;
    if (hasAssistant && (type === 'text-delta' || type === 'assistant')) return false;
    return true;
  });
}
