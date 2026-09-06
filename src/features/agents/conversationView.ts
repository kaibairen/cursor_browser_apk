import type { AgentConversation, ConversationMessage } from '../../lib/cursor/types';

export function isUserMessage(item: ConversationMessage): boolean {
  return /user/i.test(item.type);
}

export function lastUserIndex(messages: ConversationMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isUserMessage(messages[index]!)) return index;
  }
  return -1;
}

export function lastAssistantAfter(messages: ConversationMessage[], userIndex: number): number {
  for (let index = messages.length - 1; index > userIndex; index -= 1) {
    if (!isUserMessage(messages[index]!)) return index;
  }
  return -1;
}

export function timelineUserIndex(
  messages: ConversationMessage[],
  options: { activeTurn: boolean; localSend?: boolean } | boolean,
): number {
  const activeTurn = typeof options === 'boolean' ? options : options.activeTurn;
  const localSend = typeof options === 'boolean' ? activeTurn : Boolean(options.localSend);
  const latest = lastUserIndex(messages);
  if (latest < 0) return -1;
  const unanswered = lastAssistantAfter(messages, latest) < 0;
  // A new user bubble (this device or another) must own the waiting
  // 「思考中」 row. Do not park the timeline on the previous finished turn.
  if (unanswered) return latest;
  if (activeTurn && !localSend) return -1;
  return latest;
}

export function attachLatestStream(unansweredLatest: boolean, activeTurn: boolean): boolean {
  // Until the new run is live, keep the previous run's tools/thinking off the new bubble.
  return !unansweredLatest || activeTurn;
}

export function messageKey(item: ConversationMessage, index: number): string {
  return item.id || `${item.type}:${index}:${item.text.slice(0, 24)}`;
}

export function assistantCount(messages: ConversationMessage[]): number {
  return messages.reduce((count, item) => count + (isUserMessage(item) ? 0 : 1), 0);
}

export function mergeConversation(
  server: ConversationMessage[],
  local: ConversationMessage[],
): ConversationMessage[] {
  if (!server.length && local.length) return local;
  if (!local.length) return server;
  const serverAssistants = assistantCount(server);
  const localAssistants = assistantCount(local);
  const base = serverAssistants >= localAssistants && server.length ? server : local;
  const other = base === server ? local : server;
  return mergePreservingLocalUsers(base, other);
}

export function isLocalUserId(id: string): boolean {
  return (
    id.startsWith('local-user:') ||
    id.startsWith('local-user-') ||
    id.startsWith('pending-') ||
    id.startsWith('remote-user:')
  );
}

export function countUserTexts(
  messages: ConversationMessage[],
  options: { confirmedOnly?: boolean } = {},
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of messages) {
    if (!isUserMessage(item) || !item.text.trim()) continue;
    if (options.confirmedOnly && isLocalUserId(item.id)) continue;
    counts.set(item.text, (counts.get(item.text) ?? 0) + 1);
  }
  return counts;
}

export function mergePreservingLocalUsers(
  server: ConversationMessage[],
  local: ConversationMessage[],
): ConversationMessage[] {
  const taken = countUserTexts(server);
  const localSeen = new Map<string, number>();
  const missing: ConversationMessage[] = [];
  for (const item of local) {
    if (!isUserMessage(item) || !item.text.trim()) continue;
    const next = (localSeen.get(item.text) ?? 0) + 1;
    localSeen.set(item.text, next);
    if (next > (taken.get(item.text) ?? 0)) missing.push(item);
  }
  if (missing.length === 0) return server;
  if (taken.size === 0) return [...missing, ...server];
  return [...server, ...missing];
}

export function seedUserMessage(existing: AgentConversation | undefined, agentId: string, text: string): AgentConversation {
  const trimmed = text.trim();
  const messages = existing?.messages ?? [];
  if (!trimmed) return existing ?? { id: agentId, messages };
  const last = messages[messages.length - 1];
  if (last && isUserMessage(last) && last.text === trimmed && isLocalUserId(last.id)) {
    return existing ?? { id: agentId, messages };
  }
  return {
    id: existing?.id ?? agentId,
    messages: [...messages, { id: `local-user:${Date.now()}:${trimmed}`, type: 'user_message', text: trimmed }],
  };
}
