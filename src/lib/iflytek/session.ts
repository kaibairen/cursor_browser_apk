import { bytesToBase64 } from './hmac';
import {
  applyIatSlice,
  buildIatWebSocketUrl,
  decodeIatResult,
  emptyIatAssembly,
  encodeIatFrame,
  joinIatSlices,
  rfc1123Date,
  type IatAssembly,
  type IatCredentials,
  type IatStatus,
} from './protocol';

export type IatLiveSession = {
  push: (pcm: Uint8Array) => void;
  stop: () => Promise<string>;
};

const OPEN_MS = 8_000;
const END_MS = 1_200;
const MAX_MS = 60_000;

function describeIatError(code?: number, message?: string): string {
  if (code === 11200 || code === 11201) {
    return '讯飞密钥无效。请确认开通了「语音听写（流式版）」，不是 Spark 聊天。';
  }
  if (code === 10163 || /no license|not authorized|illegal/i.test(message ?? '')) {
    return '这个应用还没开通语音听写。去讯飞控制台加上「语音听写（流式版）」。';
  }
  return message || '听写服务不可用';
}

export async function startIatSession(
  credentials: IatCredentials,
  onPreview: (text: string) => void,
): Promise<IatLiveSession> {
  const url = buildIatWebSocketUrl(credentials, rfc1123Date());
  const socket = new WebSocket(url);
  let assembly: IatAssembly = emptyIatAssembly();
  let nextStatus: IatStatus = 0;
  let closed = false;
  let done = false;
  let failed: string | null = null;
  const pending: Uint8Array[] = [];

  const opened = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('听写服务连不上')), OPEN_MS);
    socket.onopen = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error('听写服务不可用'));
    };
  });

  socket.onmessage = (event) => {
    const raw = typeof event.data === 'string' ? event.data : '';
    if (!raw) return;
    try {
      const parsed = decodeIatResult(JSON.parse(raw) as unknown);
      if (parsed.code && parsed.code !== 0) {
        failed = describeIatError(parsed.code, parsed.message);
        done = true;
        return;
      }
      assembly = applyIatSlice(assembly, parsed);
      onPreview(joinIatSlices(assembly));
      if (parsed.status === 2) done = true;
    } catch {
      // ignore a split or malformed frame
    }
  };

  socket.onclose = () => {
    closed = true;
    done = true;
  };

  await opened;

  const send = (status: IatStatus, audio = '') => {
    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error(failed ?? '听写连接已断开');
    }
    socket.send(JSON.stringify(encodeIatFrame(credentials.appId, status, audio)));
    if (status !== 2) nextStatus = 1;
  };

  const flush = (status: IatStatus) => {
    if (!pending.length && status !== 2) return;
    const total = pending.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of pending) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    pending.length = 0;
    send(status, total ? bytesToBase64(merged) : '');
  };

  const limit = setTimeout(() => {
    failed = failed ?? '一次最多听 60 秒，请松手后再说。';
    done = true;
  }, MAX_MS);

  return {
    push: (pcm) => {
      if (!pcm.length || done || failed) return;
      pending.push(pcm);
      const bytes = pending.reduce((sum, chunk) => sum + chunk.length, 0);
      if (bytes >= 6400) flush(nextStatus);
    },
    stop: async () => {
      clearTimeout(limit);
      try {
        if (!failed && socket.readyState === WebSocket.OPEN) {
          flush(nextStatus);
          send(2);
          const started = Date.now();
          while (!done && Date.now() - started < END_MS) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      } catch (error) {
        failed = error instanceof Error ? error.message : '听写服务不可用';
      }
      if (!closed) {
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
      if (failed) throw new Error(failed);
      return joinIatSlices(assembly).replace(/\s+/g, ' ').trim();
    },
  };
}
