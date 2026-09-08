export type StartupLogNative = {
  write?: (stage: string) => void;
  read?: () => string;
};

export function getStartupLogNative(): StartupLogNative | null {
  try {
    const expo = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => StartupLogNative | null;
    };
    return expo.requireOptionalNativeModule?.('StartupLog') ?? null;
  } catch {
    return null;
  }
}
