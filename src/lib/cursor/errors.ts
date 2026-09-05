export class CursorApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CursorApiError';
    this.status = status;
    this.code = code;
  }
}

export class CursorAuthError extends CursorApiError {
  constructor(message = 'API Key 无效或已过期') {
    super(message, 401, 'unauthorized');
    this.name = 'CursorAuthError';
  }
}

export class CursorNetworkError extends Error {
  readonly code = 'network';

  constructor(message = NETWORK_MESSAGE) {
    super(message);
    this.name = 'CursorNetworkError';
  }
}

export const NETWORK_MESSAGE = '网页服务断线了，刷新页面再试。真机不受影响。';

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof CursorNetworkError) return true;
  if (!(error instanceof Error)) return false;
  return /fetch|network|load|ECONNREFUSED|ERR_CONNECTION|Failed to fetch|NetworkError|Network request failed|SSE 连接失败/i.test(
    error.message,
  );
}

export function isRetryableError(error: unknown): boolean {
  if (isNetworkError(error)) return true;
  return error instanceof CursorApiError && isRetryableStatus(error.status);
}

export function friendlyNetworkError(error: unknown): Error {
  if (error instanceof CursorNetworkError) return error;
  if (error instanceof CursorApiError || error instanceof CursorAuthError) return error;
  if (isNetworkError(error)) {
    return new CursorNetworkError();
  }
  return error instanceof Error ? error : new Error('网络错误');
}
