import { Platform } from 'react-native';
import { streamUrl } from './client';
import { CursorApiError, CursorAuthError } from './errors';
import { consumeSseBuffer, type SseEvent } from './sseParse';

export type { SseEvent } from './sseParse';
export { consumeSseBuffer, parseSseBlock } from './sseParse';

export type StreamHandlers = {
  onEvent: (event: SseEvent) => void;
  onError?: (error: Error) => void;
  onOpen?: () => void;
};

export function openRunStream(
  apiKey: string,
  agentId: string,
  runId: string,
  handlers: StreamHandlers,
  lastEventId?: string,
): () => void {
  if (Platform.OS === 'web' && typeof fetch === 'function') {
    return openFetchStream(apiKey, agentId, runId, handlers, lastEventId);
  }
  return openXhrStream(apiKey, agentId, runId, handlers, lastEventId);
}

function streamHeaders(apiKey: string, lastEventId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${apiKey}`,
  };
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;
  return headers;
}

function failStatus(status: number): Error {
  if (status === 401) return new CursorAuthError();
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
      const res = await fetch(streamUrl(agentId, runId), {
        headers: streamHeaders(apiKey, lastEventId),
        signal: controller.signal,
        cache: 'no-store',
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
        for (const event of consumed.events) {
          handlers.onEvent(event);
        }
      }
      if (buffer.trim()) {
        const consumed = consumeSseBuffer(`${buffer}\n\n`);
        for (const event of consumed.events) {
          handlers.onEvent(event);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      handlers.onError?.(error instanceof Error ? error : new Error('SSE 连接失败'));
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
    for (const event of consumed.events) {
      handlers.onEvent(event);
    }
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
    handlers.onError?.(new Error('SSE 连接失败'));
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
