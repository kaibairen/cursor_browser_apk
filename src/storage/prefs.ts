import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConversationMode, ModelParam, Repository } from '../lib/cursor/types';

const PREFS_KEY = 'agents_console_prefs_v1';

export type AppPrefs = {
  recentRepos: string[];
  defaultBranch: string;
  defaultAutoCreatePR: boolean;
  defaultMode: ConversationMode;
  defaultModelId?: string;
  defaultModelParams?: ModelParam[];
  defaultEnvName?: string;
  lastRepoRefreshAt?: number;
  cachedRepos?: Repository[];
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
