import { hmacSha256Base64 } from './hmac';

export const IAT_HOST = 'iat-api.xfyun.cn';
export const IAT_PATH = '/v2/iat';

export type IatStatus = 0 | 1 | 2;

export type IatCredentials = {
  appId: string;
  apiKey: string;
  apiSecret: string;
};

export type IatFrame = {
  common?: { app_id: string };
  business?: {
    language: string;
    domain: string;
    accent: string;
    vad_eos: number;
    dwa: string;
  };
  data: {
    status: IatStatus;
    format: string;
    encoding: string;
    audio: string;
  };
};

export type IatParse = {
  code?: number;
  message?: string;
  text: string;
  status: number;
  pgs?: string;
  sn?: number;
  rg?: [number, number];
};

export type IatAssembly = {
  slices: Map<number, string>;
  nextSn: number;
};

const IAT_PUNCT_RE = /^[\s。．.？?！!，,、；;：:…—\-–~～'"“”‘’]+$/u;

export function rfc1123Date(at = new Date()): string {
  return at.toUTCString();
}

export function buildIatWebSocketUrl(credentials: IatCredentials, date: string): string {
  const signatureOrigin = `host: ${IAT_HOST}\ndate: ${date}\nGET ${IAT_PATH} HTTP/1.1`;
  const signature = hmacSha256Base64(credentials.apiSecret, signatureOrigin);
  const authorizationOrigin = `api_key="${credentials.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = bytesToAsciiBase64(authorizationOrigin);
  const query = new URLSearchParams({ authorization, date, host: IAT_HOST });
  return `wss://${IAT_HOST}${IAT_PATH}?${query.toString()}`;
}

function bytesToAsciiBase64(value: string): string {
  return btoa(value);
}

export function encodeIatFrame(appId: string, status: IatStatus, audioB64 = ''): IatFrame {
  const data = {
    status,
    format: 'audio/L16;rate=16000',
    encoding: 'raw',
    audio: audioB64,
  };
  if (status !== 0) return { data };
  return {
    common: { app_id: appId },
    business: {
      language: 'zh_cn',
      domain: 'iat',
      accent: 'mandarin',
      vad_eos: 3000,
      dwa: 'wpgs',
    },
    data,
  };
}

export function emptyIatAssembly(): IatAssembly {
  return { slices: new Map(), nextSn: 1 };
}

export function isIatPunctuation(text: string): boolean {
  return text.length > 0 && IAT_PUNCT_RE.test(text);
}

export function joinIatSlices(assembly: IatAssembly): string {
  return [...assembly.slices.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, text]) => text)
    .join('');
}

function parseRg(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const from = Number(value[0]);
  const to = Number(value[1]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return undefined;
  return [from, to];
}

export function decodeIatResult(payload: unknown): IatParse {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data = root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : {};
  const result = data.result && typeof data.result === 'object' ? (data.result as Record<string, unknown>) : {};
  const words = Array.isArray(result.ws) ? result.ws : [];
  const text = words
    .flatMap((item) => {
      const row = item && typeof item === 'object' ? (item as { cw?: Array<{ w?: string }> }) : {};
      return (row.cw ?? []).map((part) => part.w ?? '');
    })
    .join('');
  const status = typeof data.status === 'number' ? data.status : 0;
  const pgs = typeof result.pgs === 'string' ? result.pgs : undefined;
  const sn = typeof result.sn === 'number' ? result.sn : undefined;
  const code = typeof root.code === 'number' ? root.code : undefined;
  const message = typeof root.message === 'string' ? root.message : undefined;
  return { code, message, text, status, pgs, sn, rg: parseRg(result.rg) };
}

export function applyIatSlice(assembly: IatAssembly, parsed: IatParse): IatAssembly {
  const previous = joinIatSlices(assembly);
  const slices = new Map(assembly.slices);
  let nextSn = assembly.nextSn;
  const sn = typeof parsed.sn === 'number' ? parsed.sn : nextSn;
  nextSn = Math.max(nextSn, sn + 1);

  if (parsed.pgs === 'rpl') {
    if (parsed.rg) {
      for (let index = parsed.rg[0]; index <= parsed.rg[1]; index += 1) {
        slices.delete(index);
      }
    } else {
      const lastKey = [...slices.keys()].sort((left, right) => left - right).at(-1);
      if (lastKey !== undefined) slices.delete(lastKey);
    }
  }

  if (parsed.text) slices.set(sn, parsed.text);
  const next = { slices, nextSn };
  const joined = joinIatSlices(next);
  if (isIatPunctuation(parsed.text) && previous && isIatPunctuation(joined) && joined.length < previous.length) {
    const restored = new Map(assembly.slices);
    const lastKey = [...restored.keys()].sort((left, right) => left - right).at(-1);
    if (lastKey === undefined) {
      restored.set(sn, parsed.text);
    } else {
      restored.set(lastKey, `${restored.get(lastKey) ?? ''}${parsed.text}`);
    }
    return { slices: restored, nextSn };
  }
  return next;
}
