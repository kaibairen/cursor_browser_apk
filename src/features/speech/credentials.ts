import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { IatCredentials } from '../../lib/iflytek/protocol';

const APP_ID = 'agents_console_iflytek_app_id';
const API_KEY = 'agents_console_iflytek_api_key';
const API_SECRET = 'agents_console_iflytek_api_secret';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const web = {
  async get(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  },
  async del(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
};

async function readSecret(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return web.get(key);
  return SecureStore.getItemAsync(key, options);
}

async function writeSecret(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return web.set(key, value);
  await SecureStore.setItemAsync(key, value, options);
}

export async function readIatCredentials(): Promise<IatCredentials | null> {
  const appId = (await readSecret(APP_ID))?.trim() ?? '';
  const apiKey = (await readSecret(API_KEY))?.trim() ?? '';
  const apiSecret = (await readSecret(API_SECRET))?.trim() ?? '';
  if (!appId || !apiKey || !apiSecret) return null;
  return { appId, apiKey, apiSecret };
}

export async function writeIatCredentials(input: IatCredentials): Promise<void> {
  await writeSecret(APP_ID, input.appId.trim());
  await writeSecret(API_KEY, input.apiKey.trim());
  await writeSecret(API_SECRET, input.apiSecret.trim());
}

export function iatConfigured(input: Partial<IatCredentials> | null): boolean {
  return Boolean(input?.appId?.trim() && input.apiKey?.trim() && input.apiSecret?.trim());
}
