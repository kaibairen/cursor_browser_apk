import 'react-native-gesture-handler';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Component, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { isNetworkError } from '../lib/cursor/errors';
import { isNetworkDown } from '../lib/cursor/reconnect';
import { colors } from '../theme';
import { hookJsErrors, logStartup } from '../lib/startupLog';

hookJsErrors();
logStartup('js-layout-import');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => count < 1 && isNetworkError(error) && !isNetworkDown(),
      refetchOnWindowFocus: false,
    },
  },
});

class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    logStartup(`js-boundary ${error.message}`);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.text, fontSize: 16, textAlign: 'center' }}>页面出错了。把应用划掉再打开。</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

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
    logStartup('js-layout-mount');
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent = 'textarea,input{outline:none!important;box-shadow:none!important;}';
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <RootErrorBoundary>
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
          </RootErrorBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
