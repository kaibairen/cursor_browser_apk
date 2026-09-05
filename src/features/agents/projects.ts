import { useEffect, useMemo, useRef, useState } from 'react';
import { getAgent } from '../../lib/cursor/client';
import type { Agent, AgentListItem } from '../../lib/cursor/types';
import { loadPrefs, rememberAgentProjects, type AgentProject } from '../../storage/prefs';
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
  return { key: 'scratch', title: '从零开始' };
}

export function agentProjectEntry(agent: Pick<Agent, 'id' | 'env' | 'repos'>): AgentProject {
  return {
    repoUrl: agent.repos?.[0]?.url,
    envName: agent.env?.name,
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
      const missing = items.filter((item) => {
        if (item.repos?.[0]?.url || item.env?.name) return false;
        if (item.id in stored || requested.current.has(item.id)) return false;
        return true;
      });
      if (!missing.length) return;

      const found: Record<string, AgentProject> = {};
      for (const item of missing) {
        if (cancelled) return;
        requested.current.add(item.id);
        try {
          const agent = await getAgent(apiKey, item.id);
          found[agent.id] = agentProjectEntry(agent);
        } catch {
          found[item.id] = {};
        }
      }
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
