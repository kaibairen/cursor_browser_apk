import {
  artifactFileName,
  artifactMediaKind,
  artifactMentionedInText,
  assignChatMedia,
  inlineArtifactPaths,
  isImageArtifactPath,
  isOpenableArtifactPath,
  isTextArtifactPath,
  isVideoArtifactPath,
  matchArtifactPath,
  mediaKindFromUrl,
  normalizeMediaSrc,
  splitMarkdownMedia,
} from '../src/lib/cursor/artifactPath.ts';
import type { Artifact, ConversationMessage } from '../src/lib/cursor/types.ts';

if (!isImageArtifactPath('artifacts/preview-chat.png')) throw new Error('png should be image');
if (!isImageArtifactPath('artifacts/Preview-Home.JPEG')) throw new Error('jpeg should be image');
if (isImageArtifactPath('artifacts/user-bubble-immediate-send.mp4')) throw new Error('mp4 is not image');
if (!isVideoArtifactPath('artifacts/user-bubble-immediate-send.mp4')) throw new Error('mp4 should be video');
if (!isVideoArtifactPath('clip.webm') || !isVideoArtifactPath('take.mov') || !isVideoArtifactPath('take.m4v')) {
  throw new Error('common video suffixes should match');
}
if (artifactMediaKind('notes.md') != null) throw new Error('markdown is not inline media');
if (artifactMediaKind('preview-chat.png') !== 'image') throw new Error('png kind');
if (artifactMediaKind('user-bubble-immediate-send.mp4') !== 'video') throw new Error('mp4 kind');
if (!isOpenableArtifactPath('user-bubble-immediate-send.mp4') || !isTextArtifactPath('notes.md')) {
  throw new Error('openable paths');
}
if (artifactFileName('artifacts/screens/preview-home.png') !== 'preview-home.png') {
  throw new Error('artifactFileName');
}
if (!artifactMentionedInText('artifacts/preview-chat.png', '见图 preview-chat.png')) {
  throw new Error('should mention filename');
}
if (mediaKindFromUrl('https://cdn.example/a.mp4?token=1') !== 'video') {
  throw new Error('url video kind');
}

const pieces = splitMarkdownMedia('先看图\n\n![首页](https://cdn.example/preview-home.png)\n\n再看视频 ![录屏](https://cdn.example/demo.mp4)');
if (pieces.length !== 4) throw new Error(`expected 4 pieces, got ${pieces.length}`);
if (pieces[0]?.type !== 'text' || !pieces[0].text.includes('先看图')) throw new Error('text before image');
if (pieces[1]?.type !== 'media' || pieces[1].kind !== 'image' || pieces[1].url !== 'https://cdn.example/preview-home.png') {
  throw new Error('image markdown');
}
if (pieces[3]?.type !== 'media' || pieces[3].kind !== 'video') throw new Error('video markdown');

const html = splitMarkdownMedia(
  '图按论文来画。<img src="/opt/cursor/artifacts/assets/experiment-architecture.png" alt="实验架构" />后面是说明。<video src="artifacts/user-bubble-immediate-send.mp4"></video>',
);
if (html.filter((piece) => piece.type === 'media').length !== 2) {
  throw new Error(`html media pieces: ${JSON.stringify(html)}`);
}
if (html[1]?.type !== 'media' || html[1].kind !== 'image' || !html[1].url.includes('experiment-architecture.png')) {
  throw new Error('html img should become an image piece');
}
if (html[3]?.type !== 'media' || html[3].kind !== 'video') {
  throw new Error('html video should become a video piece');
}
if (normalizeMediaSrc('/opt/cursor/artifacts/assets/experiment-architecture.png') !== 'artifacts/assets/experiment-architecture.png') {
  throw new Error('normalize official artifact src');
}
const matched = matchArtifactPath('/opt/cursor/artifacts/assets/experiment-architecture.png', [
  { path: 'artifacts/assets/experiment-architecture.png' },
]);
if (matched?.path !== 'artifacts/assets/experiment-architecture.png') {
  throw new Error('match official img src to artifact');
}
if (!inlineArtifactPaths('<img src="/opt/cursor/artifacts/assets/experiment-architecture.png" />', [
  { path: 'artifacts/assets/experiment-architecture.png' },
]).has('artifacts/assets/experiment-architecture.png')) {
  throw new Error('inline artifact path from html img');
}

const items: Artifact[] = [
  { path: 'artifacts/preview-chat.png', sizeBytes: 100, updatedAt: '2026-01-01T00:10:00.000Z' },
  { path: 'artifacts/user-bubble-immediate-send.mp4', sizeBytes: 200, updatedAt: '2026-01-01T01:20:00.000Z' },
  { path: 'artifacts/notes.md', sizeBytes: 12, updatedAt: '2026-01-01T00:11:00.000Z' },
];
const messages: ConversationMessage[] = [
  { id: 'u1', type: 'user_message', text: '先看截图' },
  { id: 'a1', type: 'assistant_message', text: '见图 preview-chat.png' },
  { id: 'u2', type: 'user_message', text: '再录一段' },
  { id: 'a2', type: 'assistant_message', text: '好了' },
];
const assigned = assignChatMedia(items, messages, [
  { createdAt: '2026-01-01T00:00:00.000Z' },
  { createdAt: '2026-01-01T01:00:00.000Z' },
]);
if (assigned.byUserIndex[0]?.some((item) => item.path.endsWith('preview-chat.png')) !== true) {
  throw new Error('screenshot should sit with the first user turn');
}
if (assigned.byUserIndex[2]?.some((item) => item.path.endsWith('.mp4')) !== true) {
  throw new Error('mp4 should sit with the follow-up that produced it');
}
if (assigned.orphan.length) throw new Error('dated media should not be orphaned');
if (!Array.isArray(assigned.leftover)) throw new Error('leftover must always be an array');
if (!assigned.byIndex[1]?.some((item) => item.path.endsWith('preview-chat.png'))) {
  throw new Error('mentioned image should also stay on the assistant index');
}

const undated = assignChatMedia(
  [{ path: 'artifacts/late.mp4', sizeBytes: 3, updatedAt: '' }],
  messages,
  [],
);
if (undated.byUserIndex[2]?.[0]?.path !== 'artifacts/late.mp4') {
  throw new Error('undated leftover video should stay on the latest turn, not a detached footer');
}

const waiting = assignChatMedia(
  [{ path: 'artifacts/old.mp4', sizeBytes: 3, updatedAt: '' }],
  [
    { id: 'u1', type: 'user_message', text: '先看截图' },
    { id: 'a1', type: 'assistant_message', text: '见图 preview-chat.png' },
    { id: 'u2', type: 'user_message', text: '其他端刚发的' },
  ],
  [],
);
if (waiting.byUserIndex[2]?.length) {
  throw new Error('unanswered remote user must not steal leftover media');
}
if (waiting.byUserIndex[0]?.[0]?.path !== 'artifacts/old.mp4') {
  throw new Error('leftover media should stay on the last completed turn');
}

console.log('artifact helpers ok');
