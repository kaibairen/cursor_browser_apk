import { useRouter } from 'expo-router';
import { useAuth } from '../../features/auth/AuthContext';
import { accountName } from '../../features/settings/identity';
import { AccountMenuCard, SETTINGS_HREF, type AccountMenuId } from '../../ui/accountMenu';
import { SettingsChrome } from '../../ui/settingsChrome';

export default function SettingsIndexScreen() {
  const router = useRouter();
  const { me, signOut } = useAuth();

  function onItem(id: AccountMenuId) {
    if (id === 'logout') {
      void signOut();
      return;
    }
    router.push(SETTINGS_HREF[id]);
  }

  return (
    <SettingsChrome
      title="设置"
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
    >
      <AccountMenuCard name={accountName(me)} email={me?.userEmail ?? ''} onItem={onItem} />
    </SettingsChrome>
  );
}
