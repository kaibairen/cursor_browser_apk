import { consumeSseBuffer, parseSseBlock } from '../src/lib/cursor/sseParse.ts';
import { applySseEvent, ensureThinkingLine, type TranscriptLine } from '../src/lib/cursor/sseApply.ts';
import { isLocalUserId, mergePreservingLocalUsers, seedUserMessage } from '../src/features/agents/conversationView.ts';

const parsed = parseSseBlock('id: 1\nevent: assistant\ndata: {"text":"hi"}');
if (!parsed || parsed.event !== 'assistant' || parsed.id !== '1' || parsed.data !== '{"text":"hi"}') {
  throw new Error('parseSseBlock failed');
}

const { events, rest } = consumeSseBuffer(
  'event: assistant\ndata: {"text":"a"}\n\nid: 2\nevent: tool_call\ndata: {"callId":"c1"}\n\nid: 3\n',
);
if (events.length !== 2 || events[0]?.event !== 'assistant' || events[1]?.event !== 'tool_call') {
  throw new Error('consumeSseBuffer events failed');
}
if (rest !== 'id: 3\n') {
  throw new Error(`consumeSseBuffer rest failed: ${JSON.stringify(rest)}`);
}

if (parseSseBlock(': keepalive') !== null) {
  throw new Error('comments should be ignored');
}

function play(rawEvents: { event: string; data: string; id?: string }[]) {
  const ctx = { simplified: { assistant: false, thinking: false } };
  let lines: TranscriptLine[] = [];
  let terminal = false;
  for (const event of rawEvents) {
    const next = applySseEvent(event, lines, ctx);
    lines = next.lines;
    terminal = next.terminal;
  }
  return { lines, terminal, ctx };
}

const streamed = play([
  { event: 'thinking', data: '{"text":"先看"}' },
  { event: 'thinking', data: '{"text":"问题"}' },
  { event: 'interaction_update', data: '{"type":"thinking-completed","thinkingDurationMs":1800}' },
  { event: 'assistant', data: '{"text":"黑"}' },
  { event: 'assistant', data: '{"text":"色气泡"}' },
  { event: 'result', data: '{"status":"FINISHED","text":"黑色气泡会先出现。"}' },
]);

if (streamed.lines[0]?.kind !== 'thinking' || streamed.lines[0].text !== '先看问题' || !streamed.lines[0].done) {
  throw new Error(`thinking merge failed: ${JSON.stringify(streamed.lines[0])}`);
}
if (streamed.lines[0].durationMs !== 1800) {
  throw new Error('thinking duration missing');
}
if (streamed.lines[1]?.kind !== 'assistant' || streamed.lines[1].text !== '黑色气泡会先出现。') {
  throw new Error(`assistant result upsert failed: ${JSON.stringify(streamed.lines[1])}`);
}
if (!streamed.terminal) {
  throw new Error('result should end the stream');
}

const noDup = play([
  { event: 'assistant', data: '{"text":"A"}' },
  { event: 'interaction_update', data: '{"type":"text-delta","text":"B"}' },
]);
if (noDup.lines.length !== 1 || noDup.lines[0]?.kind !== 'assistant' || noDup.lines[0].text !== 'A') {
  throw new Error('simplified assistant should win over text-delta');
}

const interactionOnly = play([
  { event: 'interaction_update', data: '{"type":"thinking-delta","text":"想"}' },
  { event: 'interaction_update', data: '{"update":{"type":"thinking-delta","text":"一下"}}' },
  { event: 'interaction_update', data: '{"type":"text-delta","text":"好"}' },
]);
if (interactionOnly.lines[0]?.kind !== 'thinking' || interactionOnly.lines[0].text !== '想一下') {
  throw new Error('nested thinking-delta failed');
}
if (interactionOnly.lines[1]?.kind !== 'assistant' || interactionOnly.lines[1].text !== '好') {
  throw new Error('text-delta failed');
}

const withPlaceholder = ensureThinkingLine([]);
if (withPlaceholder.length !== 1 || withPlaceholder[0]?.kind !== 'thinking' || withPlaceholder[0].text) {
  throw new Error('ensureThinkingLine should add an empty thinking row');
}
if (ensureThinkingLine(withPlaceholder) !== withPlaceholder) {
  throw new Error('ensureThinkingLine should be idempotent');
}

if (!isLocalUserId('local-user:你好') || !isLocalUserId('pending-1') || isLocalUserId('msg-server')) {
  throw new Error('isLocalUserId failed');
}

const mergedDup = mergePreservingLocalUsers(
  [{ id: 's1', type: 'user_message', text: '你好吗' }],
  [
    { id: 'pending-1', type: 'user_message', text: '你好吗' },
    { id: 'pending-2', type: 'user_message', text: '你好吗' },
  ],
);
if (mergedDup.length !== 2 || mergedDup[1]?.id !== 'pending-2') {
  throw new Error(`duplicate user texts should keep the extra local copy: ${JSON.stringify(mergedDup)}`);
}

const seeded = seedUserMessage({ id: 'a', messages: [{ id: 's1', type: 'user_message', text: '你好吗' }] }, 'a', '你好吗');
if (seeded.messages.length !== 2) {
  throw new Error('seedUserMessage should allow the same text on a later turn');
}

console.log('sse parse + apply ok');
