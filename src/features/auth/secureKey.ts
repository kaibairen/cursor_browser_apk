import * as SecureStore from 'expo-secure-store';

const KEY = 'agents_console_api_key';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function readApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY, options);
}

export async function writeApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, apiKey.trim(), options);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, options);
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}
