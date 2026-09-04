import { consumeSseBuffer, parseSseBlock } from '../src/lib/cursor/sseParse.ts';

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

console.log('sse parse ok');
