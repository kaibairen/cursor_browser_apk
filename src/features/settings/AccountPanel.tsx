import { Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { maskApiKey } from '../auth/secureKey';
import { Button } from '../../ui/primitives';
import { settingsStyles as styles } from '../../ui/settingsChrome';

export function AccountPanel({ onSignOut }: { onSignOut?: () => void }) {
  const { me, apiKey, signOut } = useAuth();
  return (
    <>
      <Text style={styles.body}>{me?.userEmail ?? me?.apiKeyName ?? '已连接'}</Text>
      <Text style={styles.meta}>密钥 {apiKey ? maskApiKey(apiKey) : '—'}</Text>
      <Button
        title="退出"
        variant="ghost"
        onPress={() => {
          void signOut();
          onSignOut?.();
        }}
      />
    </>
  );
}
