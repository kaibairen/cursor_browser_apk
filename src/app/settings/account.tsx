import { useRouter } from 'expo-router';
import { AccountPanel } from '../../features/settings/AccountPanel';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsAccountScreen() {
  const router = useRouter();
  return (
    <SettingsChrome
      title="账号"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    >
      <AccountPanel onSignOut={() => router.replace('/setup')} />
    </SettingsChrome>
  );
}
