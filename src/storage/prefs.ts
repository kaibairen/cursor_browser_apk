import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConversationMode, ModelParam, Repository } from '../lib/cursor/types';

const PREFS_KEY = 'agents_console_prefs_v1';

export type AgentProject = {
  repoUrl?: string;
  envName?: string;
  latestRunId?: string;
  prUrl?: string;
  additions?: number;
  deletions?: number;
  stamp?: string;
  modelId?: string;
};

export type AppPrefs = {
  recentRepos: string[];
  defaultRepoUrl?: string;
  defaultBranch: string;
  defaultAutoCreatePR: boolean;
  defaultMode: ConversationMode;
  defaultModelId?: string;
  defaultModelParams?: ModelParam[];
  defaultEnvName?: string;
  lastRepoRefreshAt?: number;
  cachedRepos?: Repository[];
  agentProjects?: Record<string, AgentProject>;
};

const defaults: AppPrefs = {
  recentRepos: [],
  defaultBranch: 'main',
  defaultAutoCreatePR: true,
  defaultMode: 'agent',
};

export async function loadPrefs(): Promise<AppPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return { ...defaults };
  try {
    return { ...defaults, ...(JSON.parse(raw) as AppPrefs) };
  } catch {
    return { ...defaults };
  }
}

export async function savePrefs(prefs: AppPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function rememberRepo(url: string): Promise<AppPrefs> {
  const prefs = await loadPrefs();
  const next = [url, ...prefs.recentRepos.filter((item) => item !== url)].slice(0, 8);
  const updated = { ...prefs, recentRepos: next };
  await savePrefs(updated);
  return updated;
}

export async function rememberAgentProjects(entries: Record<string, AgentProject>): Promise<AppPrefs> {
  const prefs = await loadPrefs();
  const current = prefs.agentProjects ?? {};
  let changed = false;
  const merged = { ...current };
  for (const [id, next] of Object.entries(entries)) {
    const prev = current[id];
    const modelId = next.modelId ?? prev?.modelId;
    if (
      prev?.repoUrl === next.repoUrl &&
      prev?.envName === next.envName &&
      prev?.stamp === next.stamp &&
      prev?.prUrl === next.prUrl &&
      prev?.additions === next.additions &&
      prev?.deletions === next.deletions &&
      prev?.modelId === modelId
    ) {
      continue;
    }
    merged[id] = { ...prev, ...next, modelId };
    changed = true;
  }
  if (!changed) return prefs;
  const ids = Object.keys(merged);
  const trimmed =
    ids.length <= 300
      ? merged
      : Object.fromEntries(ids.slice(ids.length - 300).map((id) => [id, merged[id]]));
  const updated = { ...prefs, agentProjects: trimmed };
  await savePrefs(updated);
  return updated;
}

export async function rememberAgentModel(agentId: string, modelId: string): Promise<AppPrefs> {
  const prefs = await loadPrefs();
  const current = prefs.agentProjects ?? {};
  const prev = current[agentId] ?? {};
  if (prev.modelId === modelId && prefs.defaultModelId === modelId) return prefs;
  const updated = {
    ...prefs,
    defaultModelId: modelId,
    agentProjects: {
      ...current,
      [agentId]: { ...prev, modelId },
    },
  };
  await savePrefs(updated);
  return updated;
}
