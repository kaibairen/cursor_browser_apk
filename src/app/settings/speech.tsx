import { useRouter } from 'expo-router';
import { SpeechPanel } from '../../features/settings/SpeechPanel';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsSpeechScreen() {
  const router = useRouter();
  return (
    <SettingsChrome
      title="语音听写"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
    >
      <SpeechPanel />
    </SettingsChrome>
  );
}
