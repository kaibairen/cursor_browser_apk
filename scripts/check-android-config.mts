import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function expoIntrospect(): Record<string, unknown> {
  const raw = execFileSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(raw) as Record<string, unknown>;
}

function androidAutolinkedPackages(): string[] {
  const raw = execFileSync('npx', ['expo-modules-autolinking', 'resolve', '--platform', 'android', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(raw) as { modules?: Array<{ packageName?: string }> };
  return (parsed.modules ?? []).map((item) => item.packageName ?? '').filter(Boolean);
}

function usesPermissions(config: Record<string, unknown>): Array<Record<string, string>> {
  const internal = config._internal as { modResults?: { android?: { manifest?: { manifest?: { 'uses-permission'?: Array<{ $?: Record<string, string> }> } } } } };
  const rows = internal?.modResults?.android?.manifest?.manifest?.['uses-permission'] ?? [];
  return rows.map((row) => row.$ ?? {});
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  expo?: { autolinking?: { android?: { exclude?: string[] } } };
};
if (!pkg.expo?.autolinking?.android?.exclude?.includes('expo-video')) {
  throw new Error('package.json must exclude expo-video from Android autolinking');
}

const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')) as {
  expo?: { plugins?: unknown[] };
};
if (JSON.stringify(app.expo?.plugins ?? []).includes('expo-video')) {
  throw new Error('app.json must not register the expo-video plugin on Android');
}

const config = expoIntrospect();
const permissions = usesPermissions(config);
const record = permissions.find((item) => item['android:name'] === 'android.permission.RECORD_AUDIO');
if (!record) {
  throw new Error('Android manifest must include RECORD_AUDIO so iFlytek hold-to-talk can prompt for the mic');
}
if (record['tools:node'] === 'remove') {
  throw new Error('image-picker must not strip RECORD_AUDIO; that blocks PcmRecorder on the APK');
}

const mediaBlock = readFileSync(join(root, 'src/ui/mediaBlock.tsx'), 'utf8');
if (mediaBlock.includes("from 'expo-video'") || mediaBlock.includes('from "expo-video"')) {
  throw new Error('mediaBlock must not import expo-video on the home/setup path');
}
if (!mediaBlock.includes("import('./inlineVideo')")) {
  throw new Error('chat video must load the player only when a video block renders');
}
const androidPlayer = readFileSync(join(root, 'src/ui/inlineVideo.android.tsx'), 'utf8');
if (/from ['"]expo-video['"]/.test(androidPlayer)) {
  throw new Error('Android inline video must not import expo-video');
}
if (!androidPlayer.includes("from 'expo-av'")) {
  throw new Error('Android inline video should use expo-av, which already shipped in the last working APK');
}

const pcm = readFileSync(join(root, 'src/features/speech/pcm.ts'), 'utf8');
if (!pcm.includes('PERMISSIONS.RECORD_AUDIO') || !pcm.includes("'PcmRecorder'")) {
  throw new Error('Android speech must use PcmRecorder and request RECORD_AUDIO');
}

const linked = androidAutolinkedPackages();
if (!linked.includes('pcm-recorder')) {
  throw new Error('pcm-recorder must stay autolinked in the Android APK');
}
if (!linked.includes('expo-av')) {
  throw new Error('expo-av must stay autolinked so Android can play chat video');
}
if (linked.includes('expo-video')) {
  throw new Error('expo-video must not autolink on Android; its native OnCreate crashes the APK at launch');
}

const manifest = JSON.stringify(
  (config._internal as { modResults?: { android?: { manifest?: unknown } } }).modResults?.android?.manifest ?? {},
);
if (manifest.includes('FullscreenPlayerActivity') || manifest.includes('expo.modules.video')) {
  throw new Error('Android manifest must not register ExpoVideo / FullscreenPlayerActivity');
}

console.log('android config ok');
