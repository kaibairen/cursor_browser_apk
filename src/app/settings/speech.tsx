import { SpeechPanel } from '../../features/settings/SpeechPanel';
import { useSafeBack } from '../../lib/nav';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsSpeechScreen() {
  const goBack = useSafeBack('/home');
  return (
    <SettingsChrome title="语音听写" onBack={goBack}>
      <SpeechPanel />
    </SettingsChrome>
  );
}
