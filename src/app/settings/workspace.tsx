import { WorkspacePanel } from '../../features/settings/WorkspacePanel';
import { useSafeBack } from '../../lib/nav';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsWorkspaceScreen() {
  const goBack = useSafeBack('/home');
  return (
    <SettingsChrome title="默认仓库" onBack={goBack}>
      <WorkspacePanel />
    </SettingsChrome>
  );
}
