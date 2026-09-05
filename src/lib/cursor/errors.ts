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

export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function friendlyNetworkError(error: unknown): Error {
  if (error instanceof TypeError && /fetch|network|load/i.test(error.message)) {
    return new Error('浏览器拦了直连。请硬刷新后再贴一次 Key；真机 APK 不受影响。');
  }
  return error instanceof Error ? error : new Error('网络错误');
}
