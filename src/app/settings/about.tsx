import { useRouter } from 'expo-router';
import { AboutPanel } from '../../features/settings/AboutPanel';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsAboutScreen() {
  const router = useRouter();
  return (
    <SettingsChrome
      title="关于"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    >
      <AboutPanel />
    </SettingsChrome>
  );
}
