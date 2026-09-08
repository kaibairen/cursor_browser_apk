import { Platform, Share } from 'react-native';

let hooked = false;

type StartupLogNative = {
  write?: (value: string) => void;
  read?: () => string;
};

function nativeModule(): StartupLogNative | null {
  try {
    const expo = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => StartupLogNative | null;
    };
    return expo.requireOptionalNativeModule?.('StartupLog') ?? null;
  } catch {
    return null;
  }
}

export function logStartup(stage: string): void {
  console.log(`[AgentsStartup] ${stage} os=${Platform.OS}`);
  if (Platform.OS === 'android') {
    try {
      nativeModule()?.write?.(stage);
    } catch {
      // Native module is only in the Android APK.
    }
  }
}

export function readStartupLog(): string {
  try {
    return nativeModule()?.read?.() ?? '';
  } catch {
    return '';
  }
}

export async function shareStartupLog(message: string): Promise<void> {
  const text = message.trim() || '没有启动日志';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  try {
    await Share.share({ message: text });
  } catch {
    // Keep the on-screen text selectable if the system share sheet is missing.
  }
}

export function hookJsErrors(): void {
  if (hooked || Platform.OS === 'web') return;
  hooked = true;
  const errorUtils = (
    globalThis as {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: Error, fatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: Error, fatal?: boolean) => void) => void;
      };
    }
  ).ErrorUtils;
  const previous = errorUtils?.getGlobalHandler?.();
  errorUtils?.setGlobalHandler?.((error, fatal) => {
    const stack = error?.stack?.split('\n').slice(0, 6).join(' | ') ?? '';
    logStartup(`js-error fatal=${Boolean(fatal)} ${error?.message ?? 'unknown'} ${stack}`);
    previous?.(error, fatal);
  });
}
