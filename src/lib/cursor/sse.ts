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
