import type { AgentConversation, ConversationMessage } from '../../lib/cursor/types';

export function isUserMessage(item: ConversationMessage): boolean {
  return /user/i.test(item.type);
}

export function isLocalUserId(id: string): boolean {
  return id.startsWith('local-user:') || id.startsWith('local-user-') || id.startsWith('pending-');
}

export function mergePreservingLocalUsers(
  server: ConversationMessage[],
  local: ConversationMessage[],
): ConversationMessage[] {
  const serverUserTexts = new Set(server.filter(isUserMessage).map((item) => item.text));
  const missing = local.filter((item) => isUserMessage(item) && item.text.trim() && !serverUserTexts.has(item.text));
  if (missing.length === 0) return server;
  if (serverUserTexts.size === 0) {
    return [...missing, ...server];
  }
  return [...server, ...missing];
}

export function seedUserMessage(existing: AgentConversation | undefined, agentId: string, text: string): AgentConversation {
  const trimmed = text.trim();
  const messages = existing?.messages ?? [];
  if (!trimmed || messages.some((item) => isUserMessage(item) && item.text === trimmed)) {
    return existing ?? { id: agentId, messages };
  }
  return {
    id: existing?.id ?? agentId,
    messages: [...messages, { id: `local-user:${trimmed}`, type: 'user_message', text: trimmed }],
  };
}
