import { fetch as expoFetch } from 'expo/fetch';
import { streamUrl } from './client';
import { CursorApiError, CursorAuthError, friendlyNetworkError } from './errors';
import { consumeSseBuffer, type SseEvent } from './sseParse';

export type { SseEvent } from './sseParse';
export { consumeSseBuffer, parseSseBlock } from './sseParse';

export type StreamHandlers = {
  onEvent: (event: SseEvent) => void;
  onEvents?: (events: SseEvent[]) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
};

function emitEvents(handlers: StreamHandlers, events: SseEvent[]): void {
  if (!events.length) return;
  if (handlers.onEvents) {
    handlers.onEvents(events);
    return;
  }
  for (const event of events) {
    handlers.onEvent(event);
  }
}

export function openRunStream(
  apiKey: string,
  agentId: string,
  runId: string,
  handlers: StreamHandlers,
  lastEventId?: string,
): () => void {
  return openFetchStream(apiKey, agentId, runId, handlers, lastEventId);
}

function streamHeaders(apiKey: string, lastEventId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${apiKey}`,
    'Cache-Control': 'no-cache',
  };
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;
  return headers;
}

function failStatus(status: number): Error {
  if (status === 401) return new CursorAuthError();
  if (status === 409) return new CursorApiError(`SSE ${status}`, status, 'stream_unavailable');
  return new CursorApiError(`SSE ${status}`, status, status === 410 ? 'stream_expired' : undefined);
}

function openFetchStream(
  apiKey: string,
  agentId: string,
  runId: string,
  handlers: StreamHandlers,
  lastEventId?: string,
): () => void {
  const controller = new AbortController();
  void (async () => {
    try {
      const res = await expoFetch(streamUrl(agentId, runId), {
        headers: streamHeaders(apiKey, lastEventId),
        signal: controller.signal,
      });
      if (!res.ok) {
        handlers.onError?.(failStatus(res.status));
        return;
      }
      handlers.onOpen?.();
      const reader = res.body?.getReader();
      if (!reader) {
        handlers.onError?.(new Error('SSE 连接失败'));
        return;
      }
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const consumed = consumeSseBuffer(buffer);
        buffer = consumed.rest;
        emitEvents(handlers, consumed.events);
      }
      if (buffer.trim()) {
        const consumed = consumeSseBuffer(`${buffer}\n\n`);
        emitEvents(handlers, consumed.events);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      handlers.onError?.(friendlyNetworkError(error));
    }
  })();
  return () => controller.abort();
}

function openXhrStream(
  apiKey: string,
  agentId: string,
  runId: string,
  handlers: StreamHandlers,
  lastEventId?: string,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', streamUrl(agentId, runId));
  const headers = streamHeaders(apiKey, lastEventId);
  for (const [key, value] of Object.entries(headers)) {
    xhr.setRequestHeader(key, value);
  }
  xhr.overrideMimeType?.('text/plain; charset=utf-8');

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
    emitEvents(handlers, consumed.events);
  };

  xhr.onprogress = () => {
    if (!opened && xhr.status) {
      opened = true;
      if (xhr.status >= 400) {
        handlers.onError?.(failStatus(xhr.status));
        xhr.abort();
        return;
      }
      handlers.onOpen?.();
    }
    flush();
  };

  xhr.onerror = () => {
    handlers.onError?.(friendlyNetworkError(new Error('SSE 连接失败')));
  };

  xhr.onabort = () => {
    flush();
  };

  xhr.onload = () => {
    flush();
    if (xhr.status >= 400) {
      handlers.onError?.(failStatus(xhr.status));
    }
  };

  xhr.send();
  return () => xhr.abort();
}
