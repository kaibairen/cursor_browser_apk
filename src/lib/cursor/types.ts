export type AgentStatus = 'ACTIVE' | 'IDLE' | 'ARCHIVED';

export type RunStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'FINISHED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED';

export type ConversationMode = 'agent' | 'plan';

export type EnvType = 'cloud' | 'pool' | 'machine';

export interface AgentEnv {
  type: EnvType | string;
  name?: string;
}

export interface RepoInput {
  url: string;
  startingRef?: string;
  prUrl?: string;
}

export interface ModelParam {
  id: string;
  value: string;
}

export interface PromptImage {
  data?: string;
  mimeType?: string;
  url?: string;
}

export interface PromptInput {
  text: string;
  images?: PromptImage[];
}

export interface AgentListItem {
  id: string;
  name: string;
  status: AgentStatus;
  env?: AgentEnv;
  url: string;
  createdAt: string;
  updatedAt: string;
  latestRunId?: string;
}

export interface Agent extends AgentListItem {
  repos?: RepoInput[];
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
}

export interface GitBranch {
  repoUrl: string;
  branch?: string;
  prUrl?: string;
}

export interface Run {
  id: string;
  agentId: string;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  durationMs?: number;
  result?: string;
  git?: { branches: GitBranch[] };
}

export interface Paginated<T> {
  items: T[];
  nextCursor?: string;
}

export interface Me {
  apiKeyName: string;
  createdAt: string;
  userId?: number;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string;
}

export interface ModelVariant {
  params: ModelParam[];
  displayName: string;
  description?: string;
  isDefault?: boolean;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  description?: string;
  aliases?: string[];
  parameters?: {
    id: string;
    displayName?: string;
    values: { value: string; displayName?: string }[];
  }[];
  variants?: ModelVariant[];
}

export interface Repository {
  url: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

export interface AgentUsage {
  totalUsage: TokenUsage;
  runs: {
    id: string;
    usageUuid?: string;
    usage: TokenUsage;
  }[];
}

export interface Artifact {
  path: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface ArtifactDownload {
  url: string;
  expiresAt: string;
}

export interface CreateAgentRequest {
  prompt: PromptInput;
  model?: { id: string; params?: ModelParam[] };
  name?: string;
  env?: AgentEnv;
  repos?: RepoInput[];
  workOnCurrentBranch?: boolean;
  autoCreatePR?: boolean;
  skipReviewerRequest?: boolean;
  mode?: ConversationMode;
  agentId?: string;
}

export interface CreateAgentResponse {
  agent: Agent;
  run: Run;
}

export interface CreateRunResponse {
  run: Run;
}

export const TERMINAL_RUN_STATUSES: RunStatus[] = [
  'FINISHED',
  'ERROR',
  'CANCELLED',
  'EXPIRED',
];

export function isTerminalRun(status: RunStatus): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}
