import { Platform } from 'react-native';

let hooked = false;

function writeNative(stage: string): void {
  try {
    const expo = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => { write?: (value: string) => void } | null;
    };
    expo.requireOptionalNativeModule?.('StartupLog')?.write?.(stage);
  } catch {
    // Native module is only in the Android APK.
  }
}

export function logStartup(stage: string): void {
  console.log(`[AgentsStartup] ${stage} os=${Platform.OS}`);
  if (Platform.OS === 'android') writeNative(stage);
}

export function hookJsErrors(): void {
  if (hooked || Platform.OS === 'web') return;
  hooked = true;
  const errorUtils = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => (error: Error, fatal?: boolean) => void; setGlobalHandler?: (handler: (error: Error, fatal?: boolean) => void) => void } }).ErrorUtils;
  const previous = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, fatal) => {
    logStartup(`js-error fatal=${Boolean(fatal)} ${error?.message ?? 'unknown'}`);
    previous?.(error, fatal);
  });
}
