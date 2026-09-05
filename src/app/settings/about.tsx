import { AboutPanel } from '../../features/settings/AboutPanel';
import { useSafeBack } from '../../lib/nav';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsAboutScreen() {
  const goBack = useSafeBack('/home');
  return (
    <SettingsChrome title="关于" onBack={goBack}>
      <AboutPanel />
    </SettingsChrome>
  );
}
