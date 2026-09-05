import { Platform } from 'react-native';
import { CursorApiError, CursorAuthError, friendlyNetworkError, isRetryableStatus } from './errors';
import type {
  Agent,
  AgentUsage,
  Artifact,
  ArtifactDownload,
  CreateAgentRequest,
  CreateAgentResponse,
  CreateRunResponse,
  Me,
  ModelInfo,
  Paginated,
  AgentListItem,
  PromptInput,
  Repository,
  Run,
  ConversationMode,
} from './types';

function apiOrigin(): string {
  return Platform.OS === 'web' ? '/cursor-api' : 'https://api.cursor.com';
}

type FetchOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  accept?: string;
};

function logRequest(method: string, path: string, status: number): void {
  console.log(`[cursor] ${method} ${path} ${status}`);
}

async function parseError(res: Response): Promise<CursorApiError> {
  let message = res.statusText || '请求失败';
  let code: string | undefined;
  try {
    const json = (await res.json()) as {
      message?: string;
      error?: string;
      code?: string;
    };
    message = json.message || json.error || message;
    code = json.code;
  } catch {
    // ignore non-JSON error bodies
  }
  if (res.status === 401) {
    return new CursorAuthError(message);
  }
  if (res.status === 410) {
    return new CursorApiError(message, 410, code ?? 'stream_expired');
  }
  return new CursorApiError(message, res.status, code);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cursorFetchOnce<T>(
  apiKey: string,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: options.accept ?? 'application/json',
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${apiOrigin()}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw friendlyNetworkError(error);
  }
  logRequest(method, path, res.status);

  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function cursorFetch<T>(
  apiKey: string,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await cursorFetchOnce<T>(apiKey, path, options);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof CursorApiError && isRetryableStatus(error.status);
      if (!retryable || attempt === maxAttempts - 1) {
        throw error;
      }
      const waitMs = error.status === 429 ? 2000 * (attempt + 1) : 400 * 2 ** attempt;
      await delay(waitMs);
    }
  }
  throw lastError;
}

export function getMe(apiKey: string): Promise<Me> {
  return cursorFetch<Me>(apiKey, '/v1/me');
}

export function listAgents(
  apiKey: string,
  params: { limit?: number; cursor?: string; includeArchived?: boolean } = {},
): Promise<Paginated<AgentListItem>> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 20));
  if (params.cursor) search.set('cursor', params.cursor);
  if (params.includeArchived === false) search.set('includeArchived', 'false');
  return cursorFetch<Paginated<AgentListItem>>(apiKey, `/v1/agents?${search.toString()}`);
}

export function getAgent(apiKey: string, id: string): Promise<Agent> {
  return cursorFetch<Agent>(apiKey, `/v1/agents/${id}`);
}

export function createAgent(
  apiKey: string,
  body: CreateAgentRequest,
): Promise<CreateAgentResponse> {
  return cursorFetch<CreateAgentResponse>(apiKey, '/v1/agents', {
    method: 'POST',
    body,
  });
}

export function createRun(
  apiKey: string,
  agentId: string,
  prompt: PromptInput,
  mode?: ConversationMode,
): Promise<CreateRunResponse> {
  return cursorFetch<CreateRunResponse>(apiKey, `/v1/agents/${agentId}/runs`, {
    method: 'POST',
    body: { prompt, ...(mode ? { mode } : {}) },
  });
}

export function listRuns(
  apiKey: string,
  agentId: string,
  params: { limit?: number; cursor?: string } = {},
): Promise<Paginated<Run>> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 20));
  if (params.cursor) search.set('cursor', params.cursor);
  return cursorFetch<Paginated<Run>>(
    apiKey,
    `/v1/agents/${agentId}/runs?${search.toString()}`,
  );
}

export function getRun(apiKey: string, agentId: string, runId: string): Promise<Run> {
  return cursorFetch<Run>(apiKey, `/v1/agents/${agentId}/runs/${runId}`);
}

export function cancelRun(apiKey: string, agentId: string, runId: string): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(
    apiKey,
    `/v1/agents/${agentId}/runs/${runId}/cancel`,
    { method: 'POST' },
  );
}

export function getAgentUsage(apiKey: string, agentId: string): Promise<AgentUsage> {
  return cursorFetch<AgentUsage>(apiKey, `/v1/agents/${agentId}/usage`);
}

export function listArtifacts(apiKey: string, agentId: string): Promise<{ items: Artifact[] }> {
  return cursorFetch<{ items: Artifact[] }>(apiKey, `/v1/agents/${agentId}/artifacts`);
}

export function downloadArtifact(
  apiKey: string,
  agentId: string,
  path: string,
): Promise<ArtifactDownload> {
  const search = new URLSearchParams({ path });
  return cursorFetch<ArtifactDownload>(
    apiKey,
    `/v1/agents/${agentId}/artifacts/download?${search.toString()}`,
  );
}

export function archiveAgent(apiKey: string, id: string): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(apiKey, `/v1/agents/${id}/archive`, { method: 'POST' });
}

export function unarchiveAgent(apiKey: string, id: string): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(apiKey, `/v1/agents/${id}/unarchive`, { method: 'POST' });
}

export function deleteAgent(apiKey: string, id: string): Promise<{ id: string }> {
  return cursorFetch<{ id: string }>(apiKey, `/v1/agents/${id}`, { method: 'DELETE' });
}

export function listModels(apiKey: string): Promise<{ items: ModelInfo[] }> {
  return cursorFetch<{ items: ModelInfo[] }>(apiKey, '/v1/models');
}

export function listRepositories(apiKey: string): Promise<{ items: Repository[] }> {
  return cursorFetch<{ items: Repository[] }>(apiKey, '/v1/repositories');
}

export function streamUrl(agentId: string, runId: string): string {
  return `${apiOrigin()}/v1/agents/${agentId}/runs/${runId}/stream`;
}
