import type { Me } from '../../lib/cursor/types';

export function accountName(me: Pick<Me, 'userFirstName' | 'userLastName' | 'apiKeyName'> | null): string {
  const name = [me?.userFirstName, me?.userLastName].filter(Boolean).join(' ').trim();
  return name || me?.apiKeyName || '已连接';
}
