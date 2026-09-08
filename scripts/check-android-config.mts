import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

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
  main?: string;
  expo?: { autolinking?: { android?: { exclude?: string[] } } };
};
if (pkg.main !== 'index.js') {
  throw new Error('package.json main must be index.js so the first JS breadcrumb runs before expo-router');
}
const entry = readFileSync(join(root, 'index.js'), 'utf8');
if (!entry.includes("require('expo-router/entry')") || !entry.includes('js-bundle-start')) {
  throw new Error('index.js must log js-bundle-start then load expo-router/entry');
}
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
if (/from ['"]expo-video['"]/.test(androidPlayer) || /from ['"]expo-av['"]/.test(androidPlayer)) {
  throw new Error('Android inline video must not mount expo-video or expo-av Video');
}
if (!androidPlayer.includes('openExternal')) {
  throw new Error('Android should open the video URL instead of a native player');
}

const metro = readFileSync(join(root, 'metro.config.js'), 'utf8');
if (!metro.includes("moduleName === 'expo-video'") || !metro.includes("platform === 'android'")) {
  throw new Error('Metro must stub expo-video on Android so the JS bundle cannot load it');
}

const pcm = readFileSync(join(root, 'src/features/speech/pcm.ts'), 'utf8');
if (!pcm.includes('PERMISSIONS.RECORD_AUDIO') || !pcm.includes("'PcmRecorder'")) {
  throw new Error('Android speech must use PcmRecorder and request RECORD_AUDIO');
}

const linked = androidAutolinkedPackages();
if (!linked.includes('pcm-recorder')) {
  throw new Error('pcm-recorder must stay autolinked in the Android APK');
}
if (!linked.includes('startup-log')) {
  throw new Error('startup-log must autolink on Android so launch breadcrumbs hit logcat');
}
if (!linked.includes('expo-av')) {
  throw new Error('expo-av must stay autolinked; the last working APK already shipped it');
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

const startupManifest = readFileSync(join(root, 'modules/startup-log/android/src/main/AndroidManifest.xml'), 'utf8');
if (!startupManifest.includes('StartupLogProvider') || !startupManifest.includes('startuplog')) {
  throw new Error('startup-log must register a ContentProvider so breadcrumbs run before JS');
}
if (!startupManifest.includes('CrashActivity') || !startupManifest.includes(':crash')) {
  throw new Error('startup-log must register CrashActivity in a :crash process so flash-exits can show the stack');
}
if (!JSON.stringify(app.expo?.plugins ?? []).includes('withStartupLog')) {
  throw new Error('app.json must apply the startup log MainApplication plugin');
}

const plugin = require('../plugins/withStartupLog.cjs') as {
  applyMainApplication: (src: string) => string;
  applyMainActivity: (src: string) => string;
};
const application = plugin.applyMainApplication(`
class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`);
if (
  !application.includes('MainApplication.attachBaseContext') ||
  !application.includes('MainApplication.onCreate begin') ||
  !application.includes('MainApplication.loadReactNative begin') ||
  !application.includes('MainApplication.loadReactNative ok') ||
  !application.includes('MainApplication.lifecycle ok') ||
  !application.includes('isCrashProcess') ||
  !application.includes('showAndDie') ||
  !application.includes('installHandler')
) {
  throw new Error('startup plugin must wrap attachBaseContext, onCreate, loadReactNative, and the crash page');
}
const activity = plugin.applyMainActivity(`
class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }
}
`);
if (!activity.includes('MainActivity.onCreate begin') || !activity.includes('MainActivity.super.onCreate ok')) {
  throw new Error('startup plugin must log MainActivity onCreate before and after super.onCreate');
}

const writer = readFileSync(join(root, 'modules/startup-log/android/src/main/java/com/kaibairen/startup/StartupLog.kt'), 'utf8');
if (!writer.includes('fd.sync') || !writer.includes('startup.last') || !writer.includes('VideoModule')) {
  throw new Error('StartupLog must fsync, keep last line, and record whether expo-video classes exist');
}
if (!writer.includes('showCrashScreen') || !writer.includes('CrashActivity')) {
  throw new Error('StartupLog must open CrashActivity with the uncaught exception text');
}
const jsHook = readFileSync(join(root, 'src/lib/startupLog.ts'), 'utf8');
if (!jsHook.includes('showCrash') || !jsHook.includes('fatal')) {
  throw new Error('JS fatal errors must open the native crash page on Android');
}
const about = readFileSync(join(root, 'src/features/settings/AboutPanel.tsx'), 'utf8');
if (about.includes('Share.share')) {
  throw new Error('AboutPanel must not call Share.share on web; use shareStartupLog');
}

console.log('android config ok');
