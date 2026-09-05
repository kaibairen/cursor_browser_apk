import { useRouter } from 'expo-router';
import { WorkspacePanel } from '../../features/settings/WorkspacePanel';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsWorkspaceScreen() {
  const router = useRouter();
  return (
    <SettingsChrome
      title="默认仓库"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    >
      <WorkspacePanel />
    </SettingsChrome>
  );
}
