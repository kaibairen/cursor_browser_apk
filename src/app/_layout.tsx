import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { colors } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function AuthGate({ children }: { children: ReactNode }) {
  const { ready, signedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const root = segments[0];
  const onSetup = root === 'setup';
  const onProtected = root === '(tabs)' || root === 'agent';

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!signedIn && !onSetup) {
      router.replace('/setup');
    } else if (signedIn && onSetup) {
      router.replace('/(tabs)');
    }
  }, [ready, signedIn, onSetup, router]);

  if (!ready || (!signedIn && onProtected)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  const [client] = useState(() => queryClient);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <AuthGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.bg },
                headerTintColor: colors.text,
                headerTitleStyle: { color: colors.text },
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="setup" options={{ title: '连接账号' }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="agent/[id]" options={{ title: '任务详情' }} />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
