export type SseEvent = {
  event: string;
  data: string;
  id?: string;
};

export function parseSseBlock(block: string): SseEvent | null {
  const trimmed = block.replace(/\r/g, '').trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }

  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const rawLine of trimmed.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('id:')) {
      id = line.slice(3).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0 && event === 'message') {
    return null;
  }
  return { event, data: dataLines.join('\n'), id };
}

export function consumeSseBuffer(buffer: string): { events: SseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: SseEvent[] = [];
  for (const block of parts) {
    const event = parseSseBlock(block);
    if (event) events.push(event);
  }
  return { events, rest };
}
