import {
  artifactFileName,
  artifactMediaKind,
  artifactMentionedInText,
  assignChatMedia,
  isImageArtifactPath,
  isOpenableArtifactPath,
  isTextArtifactPath,
  isVideoArtifactPath,
  mediaKindFromUrl,
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

const items: Artifact[] = [
  { path: 'artifacts/preview-chat.png', sizeBytes: 100, updatedAt: '' },
  { path: 'artifacts/user-bubble-immediate-send.mp4', sizeBytes: 200, updatedAt: '' },
  { path: 'artifacts/notes.md', sizeBytes: 12, updatedAt: '' },
];
const messages: ConversationMessage[] = [
  { id: 'u', type: 'user_message', text: '看截图' },
  { id: 'a', type: 'assistant_message', text: '截图在 preview-chat.png' },
];
const assigned = assignChatMedia(items, messages);
if (assigned.byIndex[1]?.[0]?.path !== 'artifacts/preview-chat.png') {
  throw new Error('mentioned image should sit under that assistant turn');
}
if (assigned.leftover.length !== 1 || assigned.leftover[0]?.path !== 'artifacts/user-bubble-immediate-send.mp4') {
  throw new Error('unmentioned video should remain leftover for the chat stack');
}

console.log('artifact helpers ok');
