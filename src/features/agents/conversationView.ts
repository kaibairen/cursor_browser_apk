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
  return id.startsWith('local-user:') || id.startsWith('local-user-') || id.startsWith('pending-');
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
