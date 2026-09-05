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

export function assignChatMedia<T extends { path: string }, M extends { text: string; type: string }>(
  items: T[],
  messages: M[],
): { byIndex: Record<number, T[]>; leftover: T[] } {
  const media = mediaArtifacts(items);
  const unused = new Set(media.map((item) => item.path));
  const byIndex: Record<number, T[]> = {};

  messages.forEach((message, index) => {
    if (/user/i.test(message.type)) return;
    const hit = media.filter((item) => unused.has(item.path) && artifactMentionedInText(item.path, message.text));
    if (!hit.length) return;
    byIndex[index] = hit;
    for (const item of hit) unused.delete(item.path);
  });

  return {
    byIndex,
    leftover: media.filter((item) => unused.has(item.path)),
  };
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
