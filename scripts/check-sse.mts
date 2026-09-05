import { consumeSseBuffer, parseSseBlock } from '../src/lib/cursor/sseParse.ts';
import { applySseEvent, ensureThinkingLine, type TranscriptLine } from '../src/lib/cursor/sseApply.ts';
import { isLocalUserId, lastAssistantAfter, lastUserIndex, mergePreservingLocalUsers, seedUserMessage } from '../src/features/agents/conversationView.ts';
import { eventPhase, prepareBurst, replayDelayMs } from '../src/lib/cursor/ssePace.ts';
import { defaultCatalogModelId, resolveStoredModelId } from '../src/features/agents/models.ts';
import { readModelId } from '../src/lib/cursor/modelId.ts';

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
  { event: 'interaction_update', data: '{"type":"text-delta","text":"A"}' },
]);
if (noDup.lines.length !== 1 || noDup.lines[0]?.kind !== 'assistant' || noDup.lines[0].text !== 'A') {
  throw new Error('paired text-delta should not duplicate assistant');
}

const thinkingFirst = play([
  { event: 'interaction_update', data: '{"type":"thinking-delta","text":"想"}' },
  { event: 'thinking', data: '{"text":"想"}' },
]);
if (thinkingFirst.lines.length !== 1 || thinkingFirst.lines[0]?.text !== '想') {
  throw new Error('paired thinking events should not duplicate');
}

const unavailableCtx = { simplified: { assistant: false, thinking: false }, pendingRetry: false };
const unavailable = applySseEvent(
  { event: 'error', data: '{"code":"stream_unavailable"}' },
  [],
  unavailableCtx,
);
if (!unavailable.retry || unavailable.terminal) {
  throw new Error('stream_unavailable should retry, not end the run');
}

const doneAfterUnavailable = applySseEvent(
  { event: 'done', data: '{}' },
  [],
  unavailableCtx,
);
if (!doneAfterUnavailable.retry || doneAfterUnavailable.terminal) {
  throw new Error('done after stream_unavailable should retry, not end the run');
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

const burst = prepareBurst([
  { event: 'thinking', data: '{"text":"先看问题再决定怎么回答"}', id: '1' },
  { event: 'interaction_update', data: '{"type":"thinking-delta","text":"先看问题再决定怎么回答"}' },
  { event: 'interaction_update', data: '{"type":"thinking-completed","thinkingDurationMs":1200}' },
  { event: 'assistant', data: '{"text":"黑色气泡会先出现。"}' },
  { event: 'interaction_update', data: '{"type":"text-delta","text":"黑色气泡会先出现。"}' },
]);
if (burst.some((event) => event.event === 'interaction_update' && event.data.includes('thinking-delta'))) {
  throw new Error('burst should drop paired thinking-delta');
}
if (burst.some((event) => event.event === 'interaction_update' && event.data.includes('text-delta'))) {
  throw new Error('burst should drop paired text-delta');
}
if (burst.filter((event) => event.event === 'thinking').length !== 1) {
  throw new Error('burst should keep one official thinking event');
}
if (burst.filter((event) => event.event === 'assistant').length !== 1) {
  throw new Error('burst should keep one official assistant event');
}
if (replayDelayMs({ event: 'assistant', data: '{"text":"x"}' }, { event: 'thinking', data: '{"text":"y"}' }) !== 16) {
  throw new Error('only a one-frame gap between thinking and assistant');
}
if (replayDelayMs({ event: 'assistant', data: '{"text":"x"}' }) !== 0) {
  throw new Error('live assistant should not be delayed');
}
if (lastUserIndex([{ id: '1', type: 'user_message', text: 'hi' }, { id: '2', type: 'assistant_message', text: 'yo' }]) !== 0) {
  throw new Error('lastUserIndex failed');
}
if (lastAssistantAfter([{ id: '1', type: 'user_message', text: 'hi' }, { id: '2', type: 'assistant_message', text: 'yo' }], 0) !== 1) {
  throw new Error('lastAssistantAfter failed');
}
if (eventPhase({ event: 'thinking', data: '{"text":"x"}' }) !== 'thinking') {
  throw new Error('thinking phase');
}

const paced = play(burst);
if (paced.lines[0]?.kind !== 'thinking' || !String(paced.lines[0].text).includes('先看')) {
  throw new Error(`paced thinking failed: ${JSON.stringify(paced.lines[0])}`);
}

if (defaultCatalogModelId([{ id: 'a', displayName: 'A' }, { id: 'b', displayName: 'B', variants: [{ params: [], displayName: 'B', isDefault: true }] }]) !== 'b') {
  throw new Error('defaultCatalogModelId should pick isDefault');
}
if (resolveStoredModelId('kept', 'fallback') !== 'kept') {
  throw new Error('stored model should win');
}
if (resolveStoredModelId(undefined, 'fallback') !== 'fallback') {
  throw new Error('fallback model should win');
}
if (readModelId({ model: { id: 'composer-2' } }) !== 'composer-2') {
  throw new Error('readModelId object failed');
}
if (readModelId({ modelId: 'grok' }) !== 'grok') {
  throw new Error('readModelId string failed');
}

console.log('sse parse + apply ok');
