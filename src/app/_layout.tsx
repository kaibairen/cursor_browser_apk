import 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
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
  const onPreview = root === 'preview';
  const publicRoute = onSetup || onPreview || root == null;

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!signedIn && !onSetup && !onPreview) {
      router.replace('/setup');
    } else if (signedIn && (onSetup || root === '(tabs)')) {
      router.replace('/home');
    }
  }, [ready, signedIn, onSetup, onPreview, root, router]);

  if (!ready || (!signedIn && !publicRoute)) {
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

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = 'textarea,input{outline:none!important;box-shadow:none!important;}';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <AuthGate>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="setup" />
              <Stack.Screen name="preview" />
              <Stack.Screen name="home" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="agent/[id]" />
            </Stack>
          </AuthGate>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
