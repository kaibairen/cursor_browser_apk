import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'agents_console_api_key';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Web fallback using localStorage
const webStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

export async function readApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage.getItemAsync(KEY);
  }
  return SecureStore.getItemAsync(KEY, options);
}

export async function writeApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (Platform.OS === 'web') {
    return webStorage.setItemAsync(KEY, trimmed);
  }
  await SecureStore.setItemAsync(KEY, trimmed, options);
}

export async function clearApiKey(): Promise<void> {
  if (Platform.OS === 'web') {
    return webStorage.deleteItemAsync(KEY);
  }
  await SecureStore.deleteItemAsync(KEY, options);
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}
