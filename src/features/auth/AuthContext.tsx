import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe } from '../../lib/cursor/client';
import { CursorAuthError } from '../../lib/cursor/errors';
import type { Me } from '../../lib/cursor/types';
import { clearApiKey, readApiKey, writeApiKey } from './secureKey';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  ready: boolean;
  signedIn: boolean;
  apiKey: string | null;
  me: Me | null;
  error: string | null;
  signIn: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  handleApiError: (error: unknown) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(async () => {
    await clearApiKey();
    setApiKey(null);
    setMe(null);
    setStatus('signedOut');
  }, []);

  const handleApiError = useCallback(
    (err: unknown) => {
      if (err instanceof CursorAuthError) {
        void signOut();
      }
    },
    [signOut],
  );

  const signIn = useCallback(async (nextKey: string) => {
    const trimmed = nextKey.trim();
    if (!trimmed) {
      throw new Error('请粘贴 API Key');
    }
    setError(null);
    const profile = await getMe(trimmed);
    await writeApiKey(trimmed);
    setApiKey(trimmed);
    setMe(profile);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readApiKey();
      if (!stored) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const profile = await getMe(stored);
        if (cancelled) return;
        setApiKey(stored);
        setMe(profile);
        setStatus('signedIn');
      } catch (err) {
        if (cancelled) return;
        await clearApiKey();
        setError(err instanceof Error ? err.message : '无法验证 API Key');
        setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      ready: status !== 'loading',
      signedIn: status === 'signedIn',
      apiKey,
      me,
      error,
      signIn,
      signOut,
      handleApiError,
    }),
    [status, apiKey, me, error, signIn, signOut, handleApiError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function useOptionalApiKey(): string | null {
  const { apiKey, signedIn } = useAuth();
  return signedIn && apiKey ? apiKey : null;
}

export function useApiKey(): string {
  const apiKey = useOptionalApiKey();
  if (!apiKey) {
    throw new Error('Not signed in');
  }
  return apiKey;
}
