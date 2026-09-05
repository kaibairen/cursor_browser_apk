export type ArtifactMediaKind = 'image' | 'video';

const TEXT_ARTIFACT =
  /\.(md|markdown|txt|json|csv|tsv|ya?ml|xml|html|css|js|jsx|ts|tsx|py|go|rs|java|kt|swift|sh|log|diff|patch|toml|ini|rst)$/i;
const IMAGE_ARTIFACT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const VIDEO_ARTIFACT = /\.(mp4|webm|mov|m4v)$/i;
const MARKDOWN_MEDIA = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

export type MarkdownPiece =
  | { type: 'text'; text: string }
  | { type: 'media'; kind: ArtifactMediaKind; alt: string; url: string };

export function isTextArtifactPath(path: string): boolean {
  return TEXT_ARTIFACT.test(path);
}

export function isImageArtifactPath(path: string): boolean {
  return IMAGE_ARTIFACT.test(path);
}

export function isVideoArtifactPath(path: string): boolean {
  return VIDEO_ARTIFACT.test(path);
}

export function artifactMediaKind(path: string): ArtifactMediaKind | null {
  if (isVideoArtifactPath(path)) return 'video';
  if (isImageArtifactPath(path)) return 'image';
  return null;
}

export function isOpenableArtifactPath(path: string): boolean {
  return isTextArtifactPath(path) || artifactMediaKind(path) != null;
}

export function artifactFileName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function mediaKindFromUrl(url: string): ArtifactMediaKind {
  const path = urlPath(url);
  return artifactMediaKind(path) ?? 'image';
}

export function artifactMentionedInText(path: string, text: string): boolean {
  const name = artifactFileName(path);
  return Boolean(name) && text.includes(name);
}

export function mediaArtifacts<T extends { path: string }>(items: T[]): T[] {
  return items.filter((item) => artifactMediaKind(item.path) != null);
}

export type RunStamp = { createdAt: string };

export function assignChatMedia<
  T extends { path: string; updatedAt?: string },
  M extends { text: string; type: string },
>(
  items: T[],
  messages: M[],
  runs: RunStamp[] = [],
): { byUserIndex: Record<number, T[]>; orphan: T[] } {
  const media = mediaArtifacts(items);
  const unused = new Set(media.map((item) => item.path));
  const byUserIndex: Record<number, T[]> = {};
  const userIndices = messages.flatMap((message, index) => (/user/i.test(message.type) ? [index] : []));

  messages.forEach((message, index) => {
    if (/user/i.test(message.type)) return;
    const hit = media.filter((item) => unused.has(item.path) && artifactMentionedInText(item.path, message.text));
    if (!hit.length) return;
    addAt(byUserIndex, ownerUserIndex(messages, index), hit);
    for (const item of hit) unused.delete(item.path);
  });

  const sortedRuns = [...runs].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (sortedRuns.length && userIndices.length) {
    for (const item of media) {
      if (!unused.has(item.path)) continue;
      const time = Date.parse(item.updatedAt ?? '');
      if (!Number.isFinite(time)) continue;
      const runIndex = runIndexForTime(time, sortedRuns);
      const userIndex = userIndices[Math.min(runIndex, userIndices.length - 1)];
      if (userIndex == null) continue;
      addAt(byUserIndex, userIndex, [item]);
      unused.delete(item.path);
    }
  }

  const leftover = media.filter((item) => unused.has(item.path));
  const lastUser = userIndices[userIndices.length - 1];
  if (leftover.length && lastUser != null) {
    addAt(byUserIndex, lastUser, leftover);
    return { byUserIndex: sortAssigned(byUserIndex), orphan: [] };
  }

  return { byUserIndex: sortAssigned(byUserIndex), orphan: leftover };
}

export function ownerUserIndex(messages: { type: string }[], index: number): number {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (/user/i.test(messages[cursor]?.type ?? '')) return cursor;
  }
  return -1;
}

function runIndexForTime(time: number, runs: RunStamp[]): number {
  if (time < Date.parse(runs[0]!.createdAt)) return 0;
  for (let index = 0; index < runs.length; index += 1) {
    const next = runs[index + 1];
    if (!next || time < Date.parse(next.createdAt)) return index;
  }
  return runs.length - 1;
}

function addAt<T>(map: Record<number, T[]>, index: number, items: T[]): void {
  if (index < 0 || !items.length) return;
  map[index] = [...(map[index] ?? []), ...items];
}

function sortAssigned<T extends { path: string; updatedAt?: string }>(
  map: Record<number, T[]>,
): Record<number, T[]> {
  const next: Record<number, T[]> = {};
  for (const [key, items] of Object.entries(map)) {
    next[Number(key)] = [...items].sort((a, b) => {
      const timeA = Date.parse(a.updatedAt ?? '') || 0;
      const timeB = Date.parse(b.updatedAt ?? '') || 0;
      if (timeA !== timeB) return timeA - timeB;
      const videoA = artifactMediaKind(a.path) === 'video' ? 1 : 0;
      const videoB = artifactMediaKind(b.path) === 'video' ? 1 : 0;
      return videoA - videoB;
    });
  }
  return next;
}

export function splitMarkdownMedia(text: string): MarkdownPiece[] {
  const pieces: MarkdownPiece[] = [];
  const re = new RegExp(MARKDOWN_MEDIA.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      pieces.push({ type: 'text', text: text.slice(last, match.index) });
    }
    pieces.push({
      type: 'media',
      kind: mediaKindFromUrl(match[2]!),
      alt: match[1] ?? '',
      url: match[2]!,
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    pieces.push({ type: 'text', text: text.slice(last) });
  }
  return pieces.length ? pieces : [{ type: 'text', text }];
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}
