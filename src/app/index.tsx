import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { logStartup } from '../lib/startupLog';
import { colors } from '../theme';

export default function Index() {
  const { ready, signedIn } = useAuth();
  logStartup(`js-index ready=${ready} signedIn=${signedIn}`);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return <Redirect href={signedIn ? '/home' : '/setup'} />;
}
