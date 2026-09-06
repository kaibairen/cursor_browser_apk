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

function usesPermissions(config: Record<string, unknown>): Array<Record<string, string>> {
  const internal = config._internal as { modResults?: { android?: { manifest?: { manifest?: { 'uses-permission'?: Array<{ $?: Record<string, string> }> } } } } };
  const rows = internal?.modResults?.android?.manifest?.manifest?.['uses-permission'] ?? [];
  return rows.map((row) => row.$ ?? {});
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
  throw new Error('chat video must load expo-video only when a video block renders');
}

const pcm = readFileSync(join(root, 'src/features/speech/pcm.ts'), 'utf8');
if (!pcm.includes('PERMISSIONS.RECORD_AUDIO') || !pcm.includes("'PcmRecorder'")) {
  throw new Error('Android speech must use PcmRecorder and request RECORD_AUDIO');
}

const autolinked = (config._internal as { autolinkedModules?: string[] }).autolinkedModules ?? [];
if (!autolinked.includes('pcm-recorder')) {
  throw new Error('pcm-recorder must stay autolinked in the Android APK');
}
if (!autolinked.includes('expo-video')) {
  throw new Error('expo-video stays in the binary; only JS load is deferred');
}

console.log('android config ok');
