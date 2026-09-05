import type { SseEvent } from './sseParse';
import type { RunStatus } from './types';

export type TranscriptLine =
  | { kind: 'assistant'; text: string }
  | { kind: 'thinking'; text: string; durationMs?: number; done?: boolean }
  | { kind: 'tool'; callId: string; name: string; status: string; detail?: string; args?: Record<string, unknown> };

export type StreamApplyContext = {
  lastEventId?: string;
  simplified: { assistant: boolean; thinking: boolean };
  pendingRetry?: boolean;
};

export type StreamApplyResult = {
  lines: TranscriptLine[];
  lastEventId?: string;
  terminal: boolean;
  retry?: boolean;
  runStatus?: RunStatus;
  resultText?: string;
  durationMs?: number;
};

export function ensureThinkingLine(lines: TranscriptLine[]): TranscriptLine[] {
  if (lines.some((line) => line.kind === 'thinking')) return lines;
  return [{ kind: 'thinking', text: '', done: false }, ...lines];
}

export function applySseEvent(
  event: SseEvent,
  lines: TranscriptLine[],
  ctx: StreamApplyContext,
): StreamApplyResult {
  const lastEventId = event.id || ctx.lastEventId;
  if (event.id) ctx.lastEventId = event.id;
  if (event.event === 'heartbeat' || event.event === 'status') {
    return { lines, lastEventId, terminal: false };
  }

  if (event.event === 'assistant' || event.event === 'thinking') {
    const text = readTextPayload(event.data);
    if (!text) return { lines, lastEventId, terminal: false };
    ctx.pendingRetry = false;
    if (event.event === 'assistant') ctx.simplified.assistant = true;
    else ctx.simplified.thinking = true;
    return {
      lines: appendText(lines, event.event === 'thinking' ? 'thinking' : 'assistant', text),
      lastEventId,
      terminal: false,
    };
  }

  if (event.event === 'interaction_update') {
    return { lines: applyInteractionUpdate(event.data, lines, ctx), lastEventId, terminal: false };
  }

  if (event.event === 'tool_call') {
    return { lines: applyToolCall(event.data, lines), lastEventId, terminal: false };
  }

  if (event.event === 'result') {
    ctx.pendingRetry = false;
    try {
      const payload = JSON.parse(event.data) as {
        text?: string;
        status?: RunStatus;
        durationMs?: number;
      };
      const next = payload.text
        ? upsertAssistant(finishThinking(lines), payload.text)
        : finishThinking(lines);
      return {
        lines: next,
        lastEventId,
        terminal: true,
        runStatus: payload.status,
        resultText: payload.text,
        durationMs: payload.durationMs,
      };
    } catch {
      return { lines: finishThinking(lines), lastEventId, terminal: true };
    }
  }

  if (event.event === 'done') {
    if (ctx.pendingRetry) {
      return { lines, lastEventId, terminal: false, retry: true };
    }
    return { lines: finishThinking(lines), lastEventId, terminal: true };
  }

  if (event.event === 'error') {
    try {
      const payload = JSON.parse(event.data) as { code?: string };
      if (payload.code === 'stream_unavailable') {
        ctx.pendingRetry = true;
        return { lines, lastEventId, terminal: false, retry: true };
      }
    } catch {
      // fall through
    }
    return { lines: finishThinking(lines), lastEventId, terminal: true, runStatus: 'ERROR' };
  }

  return { lines, lastEventId, terminal: false };
}

export function applySseEvents(
  events: SseEvent[],
  lines: TranscriptLine[],
  ctx: StreamApplyContext,
): StreamApplyResult {
  let current = lines;
  let result: StreamApplyResult = { lines: current, lastEventId: ctx.lastEventId, terminal: false };
  for (const event of events) {
    result = applySseEvent(event, current, ctx);
    current = result.lines;
    if (result.retry || result.terminal) break;
  }
  return result;
}

function readTextPayload(raw: string): string {
  try {
    const payload = JSON.parse(raw) as { text?: unknown };
    return typeof payload.text === 'string' ? payload.text : '';
  } catch {
    return '';
  }
}

function unwrapUpdate(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed.update === 'object' && parsed.update) {
      return { ...parsed, ...(parsed.update as Record<string, unknown>) };
    }
    return parsed;
  } catch {
    return null;
  }
}

function applyInteractionUpdate(
  raw: string,
  lines: TranscriptLine[],
  ctx: StreamApplyContext,
): TranscriptLine[] {
  const payload = unwrapUpdate(raw);
  if (!payload) return lines;
  const type = String(payload.type ?? '');
  const text = typeof payload.text === 'string' ? payload.text : '';

  if ((type === 'text-delta' || type === 'assistant') && text && !ctx.simplified.assistant) {
    return appendText(lines, 'assistant', text);
  }
  if ((type === 'thinking-delta' || type === 'thinking') && text && !ctx.simplified.thinking) {
    return appendText(lines, 'thinking', text);
  }
  if (type === 'thinking-completed') {
    const durationMs =
      typeof payload.thinkingDurationMs === 'number'
        ? payload.thinkingDurationMs
        : typeof payload.thinking_duration_ms === 'number'
          ? payload.thinking_duration_ms
          : undefined;
    return markLastThinkingDone(lines, durationMs);
  }
  if (type === 'tool-call-started' || type === 'tool-call-completed' || type === 'partial-tool-call') {
    const toolCall = asRecord(payload.toolCall);
    return upsertTool(lines, {
      callId: String(payload.callId ?? payload.call_id ?? ''),
      name: String(toolCall?.name ?? toolCall?.toolName ?? payload.toolName ?? payload.name ?? 'tool'),
      status: type === 'tool-call-completed' ? 'completed' : 'running',
      args: readNestedArgs(payload, toolCall),
    });
  }
  return lines;
}

function applyToolCall(raw: string, lines: TranscriptLine[]): TranscriptLine[] {
  try {
    const payload = JSON.parse(raw) as {
      callId?: string;
      name?: string;
      status?: string;
      args?: unknown;
    };
    return upsertTool(lines, {
      callId: String(payload.callId ?? ''),
      name: String(payload.name ?? 'tool'),
      status: String(payload.status ?? 'running'),
      args: readNestedArgs(payload as Record<string, unknown>),
      detail: payload.args ? summarizeArgs(payload.args) : undefined,
    });
  } catch {
    return lines;
  }
}

function appendText(
  lines: TranscriptLine[],
  kind: 'assistant' | 'thinking',
  text: string,
): TranscriptLine[] {
  if (!text) return lines;
  const last = lines[lines.length - 1];
  if (kind === 'assistant' && last?.kind === 'assistant') {
    if (text === last.text || last.text.endsWith(text)) return lines;
    if (text.startsWith(last.text)) return [...lines.slice(0, -1), { kind, text }];
    return [...lines.slice(0, -1), { kind, text: last.text + text }];
  }
  if (kind === 'thinking' && last?.kind === 'thinking' && !last.done) {
    if (text === last.text || last.text.endsWith(text)) return lines;
    if (text.startsWith(last.text)) return [...lines.slice(0, -1), { ...last, text }];
    return [...lines.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...lines, kind === 'thinking' ? { kind, text, done: false } : { kind, text }];
}

function upsertAssistant(lines: TranscriptLine[], text: string): TranscriptLine[] {
  const last = lines[lines.length - 1];
  if (last && last.kind === 'assistant') {
    return last.text === text ? lines : [...lines.slice(0, -1), { kind: 'assistant', text }];
  }
  return [...lines, { kind: 'assistant', text }];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNestedArgs(
  payload: Record<string, unknown>,
  nested?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  const raw = payload.args ?? payload.input ?? payload.params ?? nested?.args ?? nested?.input;
  const args =
    typeof raw === 'string' && raw.trim()
      ? { path: raw.trim() }
      : asRecord(raw);
  const result = asRecord(payload.result);
  const success = asRecord(result?.success);
  const merged = { ...success, ...args };
  return Object.keys(merged).length ? merged : undefined;
}

function betterToolName(next?: string, previous?: string): string {
  const incoming = next?.trim() || '';
  const kept = previous?.trim() || '';
  const generic = /^(tool|mcp|unknown)?$/i;
  if (incoming && !generic.test(incoming)) return incoming;
  if (kept && !generic.test(kept)) return kept;
  return incoming || kept || 'tool';
}

function upsertTool(
  lines: TranscriptLine[],
  tool: { callId: string; name: string; status: string; detail?: string; args?: Record<string, unknown> },
): TranscriptLine[] {
  if (!tool.callId) return [...lines, { kind: 'tool', ...tool, callId: `tool-${lines.length}` }];
  const existing = lines.findIndex((line) => line.kind === 'tool' && line.callId === tool.callId);
  const previous = existing >= 0 && lines[existing]?.kind === 'tool' ? lines[existing] : null;
  const next: TranscriptLine = {
    kind: 'tool',
    callId: tool.callId,
    name:
      betterToolName(tool.name, previous?.name),
    status: tool.status,
    detail: tool.detail ?? previous?.detail,
    args: { ...previous?.args, ...tool.args },
  };
  if (existing >= 0) {
    const copy = [...lines];
    copy[existing] = next;
    return copy;
  }
  return [...lines, next];
}

function markLastThinkingDone(lines: TranscriptLine[], durationMs?: number): TranscriptLine[] {
  const index = [...lines].reverse().findIndex((line) => line.kind === 'thinking');
  if (index < 0) return lines;
  const real = lines.length - 1 - index;
  const current = lines[real];
  if (!current || current.kind !== 'thinking') return lines;
  const copy = [...lines];
  copy[real] = { ...current, done: true, durationMs: durationMs ?? current.durationMs };
  return copy;
}

function finishThinking(lines: TranscriptLine[]): TranscriptLine[] {
  return lines.map((line) => (line.kind === 'thinking' ? { ...line, done: true } : line));
}

function summarizeArgs(args: unknown): string {
  try {
    const text = JSON.stringify(args);
    return text.length > 140 ? `${text.slice(0, 137)}...` : text;
  } catch {
    return '';
  }
}
