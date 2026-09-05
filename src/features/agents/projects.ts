import { useEffect, useMemo, useRef, useState } from 'react';
import { getAgent, getRun } from '../../lib/cursor/client';
import { getPullDiff } from '../../lib/githubPr';
import type { Agent, AgentListItem, Run } from '../../lib/cursor/types';
import { loadPrefs, rememberAgentProjects, type AgentProject, type AppPrefs } from '../../storage/prefs';
import { useOptionalApiKey } from '../auth/AuthContext';

export function repoShortName(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^github\.com\//, '')
    .replace(/\.git$/, '');
}

export function normalizeRepoUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://github.com/${trimmed.replace(/^github\.com\//, '')}`;
}

export function projectOf(
  item: Pick<AgentListItem, 'id' | 'env' | 'repos'>,
  cache: Record<string, AgentProject> = {},
): { key: string; title: string } {
  const repo = item.repos?.[0]?.url || cache[item.id]?.repoUrl;
  if (repo) {
    return { key: `repo:${repoShortName(repo).toLowerCase()}`, title: repoShortName(repo) };
  }
  const envName = item.env?.name || cache[item.id]?.envName;
  if (envName) {
    return { key: `env:${envName.toLowerCase()}`, title: envName };
  }
  return { key: 'unbound', title: '未绑定仓库' };
}

export function resolvedDefaultRepo(prefs: AppPrefs | null | undefined): string {
  if (!prefs) return '';
  return prefs.defaultRepoUrl?.trim() || prefs.recentRepos[0] || prefs.cachedRepos?.[0]?.url || '';
}

export function agentProjectEntry(
  agent: Pick<Agent, 'id' | 'env' | 'repos' | 'latestRunId'>,
  extra?: { modelId?: string },
): AgentProject {
  return {
    repoUrl: agent.repos?.[0]?.url,
    envName: agent.env?.name,
    latestRunId: agent.latestRunId,
    modelId: extra?.modelId,
  };
}

export function listStamp(item: Pick<AgentListItem, 'latestRunId' | 'updatedAt' | 'status'>): string {
  return `${item.latestRunId ?? ''}:${item.updatedAt}:${item.status}`;
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function extractRunDiff(run: Run): {
  additions?: number;
  deletions?: number;
  prUrl?: string;
  repoUrl?: string;
} {
  const branch = run.git?.branches?.[0];
  const extra = run as Run & {
    diff?: { additions?: number; deletions?: number };
    stats?: { additions?: number; deletions?: number };
  };
  return {
    additions: numberField(run.additions) ?? numberField(extra.diff?.additions) ?? numberField(extra.stats?.additions),
    deletions: numberField(run.deletions) ?? numberField(extra.diff?.deletions) ?? numberField(extra.stats?.deletions),
    prUrl: branch?.prUrl,
    repoUrl: branch?.repoUrl,
  };
}

export function groupByProject<T>(
  items: T[],
  project: (item: T) => { key: string; title: string },
): { key: string; title: string; data: T[] }[] {
  const map = new Map<string, { key: string; title: string; data: T[] }>();
  const order: string[] = [];
  for (const item of items) {
    const next = project(item);
    let section = map.get(next.key);
    if (!section) {
      section = { key: next.key, title: next.title, data: [] };
      map.set(next.key, section);
      order.push(next.key);
    }
    section.data.push(item);
  }
  return order.map((key) => map.get(key)!);
}

async function hydrateListItem(
  apiKey: string,
  item: AgentListItem,
  previous: AgentProject | undefined,
  stamp: string,
): Promise<AgentProject> {
  const next: AgentProject = {
    repoUrl: item.repos?.[0]?.url || previous?.repoUrl,
    envName: item.env?.name || previous?.envName,
    latestRunId: item.latestRunId || previous?.latestRunId,
    prUrl: previous?.prUrl,
    additions: previous?.additions,
    deletions: previous?.deletions,
    stamp,
    modelId: previous?.modelId,
  };

  try {
    if (item.latestRunId) {
      const run = await getRun(apiKey, item.id, item.latestRunId);
      const extracted = extractRunDiff(run);
      if (extracted.prUrl && extracted.prUrl !== previous?.prUrl) {
        next.additions = extracted.additions;
        next.deletions = extracted.deletions;
      } else {
        next.additions = extracted.additions ?? next.additions;
        next.deletions = extracted.deletions ?? next.deletions;
      }
      next.prUrl = extracted.prUrl || next.prUrl;
      if (extracted.repoUrl) next.repoUrl = next.repoUrl || extracted.repoUrl;
      if (run.model?.id) next.modelId = run.model.id;
    }
    if (!next.repoUrl || !next.envName) {
      try {
        const agent = await getAgent(apiKey, item.id);
        next.repoUrl = next.repoUrl || agent.repos?.[0]?.url;
        next.envName = next.envName || agent.env?.name;
        next.latestRunId = next.latestRunId || agent.latestRunId;
        if (agent.model?.id) next.modelId = agent.model.id;
        if (!next.prUrl && agent.latestRunId && agent.latestRunId !== item.latestRunId) {
          const run = await getRun(apiKey, item.id, agent.latestRunId);
          const extracted = extractRunDiff(run);
          next.prUrl = extracted.prUrl || next.prUrl;
          next.additions = extracted.additions ?? next.additions;
          next.deletions = extracted.deletions ?? next.deletions;
          next.repoUrl = next.repoUrl || extracted.repoUrl;
        }
      } catch {
        // keep whatever we already have
      }
    }
    if (next.prUrl && next.additions == null) {
      const diff = await getPullDiff(next.prUrl);
      if (diff) {
        next.additions = diff.additions;
        next.deletions = diff.deletions;
      }
    }
  } catch {
    // stamp is still written so we do not retry this snapshot in a loop
  }

  return next;
}

export function useHydrateAgentProjects(items: AgentListItem[]): Record<string, AgentProject> {
  const apiKey = useOptionalApiKey();
  const [cache, setCache] = useState<Record<string, AgentProject>>({});
  const requested = useRef(new Set<string>());
  const ids = useMemo(() => items.map((item) => item.id).join(','), [items]);

  useEffect(() => {
    void loadPrefs().then((prefs) => setCache(prefs.agentProjects ?? {}));
  }, []);

  useEffect(() => {
    if (!apiKey || !items.length) return;
    let cancelled = false;

    void (async () => {
      const prefs = await loadPrefs();
      const stored = prefs.agentProjects ?? {};
      setCache((current) => ({ ...stored, ...current }));
      const pending = items.slice(0, 24).filter((item) => {
        const stamp = listStamp(item);
        if (requested.current.has(`${item.id}:${stamp}`)) return false;
        const cached = stored[item.id] ?? cache[item.id];
        return cached?.stamp !== stamp;
      });
      if (!pending.length) return;

      const found: Record<string, AgentProject> = {};
      const queue = [...pending];
      const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length && !cancelled) {
          const item = queue.shift();
          if (!item) return;
          const stamp = listStamp(item);
          requested.current.add(`${item.id}:${stamp}`);
          found[item.id] = await hydrateListItem(apiKey, item, stored[item.id] ?? cache[item.id], stamp);
        }
      });
      await Promise.all(workers);
      if (cancelled || !Object.keys(found).length) return;
      setCache((current) => ({ ...current, ...found }));
      await rememberAgentProjects(found);
    })();

    return () => {
      cancelled = true;
    };
  }, [apiKey, ids, items]);

  return cache;
}
