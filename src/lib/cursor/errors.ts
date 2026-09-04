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
