import { streamUrl } from './client';
import { CursorApiError, CursorAuthError } from './errors';

export type SseEvent = {
  event: string;
  data: string;
  id?: string;
};

export type StreamHandlers = {
  onEvent: (event: SseEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
};

export function parseSseBlock(block: string): SseEvent | null {
  const trimmed = block.replace(/\r/g, '').trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }

  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of trimmed.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('id:')) {
      id = line.slice(3).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0 && event === 'message') {
    return null;
  }
  return { event, data: dataLines.join('\n'), id };
}

export function consumeSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of parts) {
    const event = parseSseBlock(block);
    if (event) events.push(event);
  }
  return { events, rest };
}

export function openRunStream(
  apiKey: string,
  agentId: string,
  runId: string,
  handlers: StreamHandlers,
  lastEventId?: string,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', streamUrl(agentId, runId));
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
  if (lastEventId) {
    xhr.setRequestHeader('Last-Event-ID', lastEventId);
  }

  let offset = 0;
  let buffer = '';
  let opened = false;

  const flush = () => {
    const chunk = xhr.responseText.slice(offset);
    offset = xhr.responseText.length;
    if (!chunk) return;
    buffer += chunk;
    const consumed = consumeSseBuffer(buffer);
    buffer = consumed.rest;
    for (const event of consumed.events) {
      handlers.onEvent(event);
    }
  };

  xhr.onprogress = () => {
    if (!opened && xhr.status) {
      opened = true;
      if (xhr.status === 401) {
        handlers.onError?.(new CursorAuthError());
        xhr.abort();
        return;
      }
      if (xhr.status >= 400) {
        handlers.onError?.(
          new CursorApiError(`SSE ${xhr.status}`, xhr.status, xhr.status === 410 ? 'stream_expired' : undefined),
        );
        xhr.abort();
        return;
      }
      handlers.onOpen?.();
    }
    flush();
  };

  xhr.onerror = () => {
    handlers.onError?.(new Error('SSE 连接失败'));
  };

  xhr.onabort = () => {
    flush();
  };

  xhr.onload = () => {
    flush();
    if (xhr.status >= 400) {
      handlers.onError?.(
        new CursorApiError(`SSE ${xhr.status}`, xhr.status, xhr.status === 410 ? 'stream_expired' : undefined),
      );
    }
  };

  xhr.send();
  return () => xhr.abort();
}
