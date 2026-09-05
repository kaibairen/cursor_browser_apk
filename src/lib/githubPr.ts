import { Platform } from 'react-native';

export function parseGithubPrUrl(url: string): { owner: string; repo: string; number: string } | null {
  try {
    const parsed = new URL(url);
    if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) return null;
    const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, ''), number: match[3] };
  } catch {
    return null;
  }
}

export async function getPullDiff(prUrl: string): Promise<{ additions: number; deletions: number } | null> {
  const parsed = parseGithubPrUrl(prUrl);
  if (!parsed) return null;
  const url =
    Platform.OS === 'web'
      ? `/cursor-api/github-pr?url=${encodeURIComponent(prUrl)}`
      : `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'agents-console',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { additions?: unknown; deletions?: unknown };
    if (typeof json.additions !== 'number' || typeof json.deletions !== 'number') return null;
    return { additions: json.additions, deletions: json.deletions };
  } catch {
    return null;
  }
}
