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

export function replayDelayMs(event: SseEvent): number {
  const phase = eventPhase(event);
  if (phase === 'end' || phase === 'meta' || phase === 'retry') return 0;
  if (event.event === 'interaction_update') {
    const type = String(readSseJson(event.data)?.type ?? '');
    if (type === 'thinking-completed') return 320;
  }
  if (phase === 'thinking') return 28;
  if (phase === 'assistant') return 22;
  if (phase === 'tool') return 90;
  return 16;
}

function textOf(event: SseEvent): string {
  const payload = readSseJson(event.data);
  return typeof payload?.text === 'string' ? payload.text : '';
}

function withText(event: SseEvent, text: string, keepId: boolean): SseEvent {
  const payload = readSseJson(event.data) ?? {};
  return {
    event: event.event,
    data: JSON.stringify({ ...payload, text }),
    id: keepId ? event.id : undefined,
  };
}

export function expandTextEvent(event: SseEvent): SseEvent[] {
  const phase = eventPhase(event);
  if (phase !== 'thinking' && phase !== 'assistant') return [event];
  if (event.event === 'interaction_update') {
    const type = String(readSseJson(event.data)?.type ?? '');
    if (type === 'thinking-completed') return [event];
  }
  const text = textOf(event);
  if (text.length <= 6) return [event];
  const size = text.length > 120 ? 5 : text.length > 40 ? 3 : 2;
  const chunks: SseEvent[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(withText(event, text.slice(index, index + size), index === 0));
  }
  return chunks;
}

export function prepareBurst(events: SseEvent[]): SseEvent[] {
  const hasThinking = events.some((event) => event.event === 'thinking');
  const hasAssistant = events.some((event) => event.event === 'assistant');
  return events
    .filter((event) => {
      if (event.event !== 'interaction_update') return true;
      const type = String(readSseJson(event.data)?.type ?? '');
      if (hasThinking && (type === 'thinking-delta' || type === 'thinking')) return false;
      if (hasAssistant && (type === 'text-delta' || type === 'assistant')) return false;
      return true;
    })
    .flatMap(expandTextEvent);
}
