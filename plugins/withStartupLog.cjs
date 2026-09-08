const { withMainActivity, withMainApplication } = require('@expo/config-plugins');

const MARK = 'AgentsStartup';

function logStmt(message, contextExpr) {
  return [
    `android.util.Log.e("${MARK}", "${message}")`,
    `try { com.kaibairen.startup.StartupLog.write(${contextExpr}, "${message}") } catch (_: Throwable) {}`,
  ].join('\n    ');
}

function injectAfterOnCreate(src, message, contextExpr) {
  if (src.includes(message)) return src;
  const kotlin = src.replace(
    /override fun onCreate\(\w*(?::\s*Bundle\?)?\)\s*\{/,
    (block) => `${block}\n    ${logStmt(message, contextExpr)}`,
  );
  if (kotlin !== src) return kotlin;
  return src.replace(
    /void onCreate\(Bundle\s+\w+\)\s*\{/,
    (block) => `${block}\n    android.util.Log.e("${MARK}", "${message}");`,
  );
}

function injectCrashProcessGuard(src) {
  if (src.includes('StartupLog.isCrashProcess')) return src;
  let next = src.replace(
    /override fun attachBaseContext\(base: android\.content\.Context\) \{\n/,
    `override fun attachBaseContext(base: android.content.Context) {\n    if (com.kaibairen.startup.StartupLog.isCrashProcess(base)) {\n      super.attachBaseContext(base)\n      return\n    }\n`,
  );
  next = next.replace(
    /override fun onCreate\(\) \{\n/,
    `override fun onCreate() {\n    if (com.kaibairen.startup.StartupLog.isCrashProcess(this)) {\n      super.onCreate()\n      return\n    }\n`,
  );
  return next;
}

function injectAttachBaseContext(src) {
  if (src.includes('MainApplication.attachBaseContext')) return src;
  if (/override fun attachBaseContext/.test(src)) {
    return src.replace(
      /override fun attachBaseContext\([^)]*\)\s*\{/,
      (block) => `${block}\n    ${logStmt('MainApplication.attachBaseContext', 'this')}`,
    );
  }
  return src.replace(
    /override fun onCreate\(\)\s*\{/,
    `override fun attachBaseContext(base: android.content.Context) {\n    android.util.Log.e("${MARK}", "MainApplication.attachBaseContext")\n    try { com.kaibairen.startup.StartupLog.write(base, "MainApplication.attachBaseContext") } catch (_: Throwable) {}\n    super.attachBaseContext(base)\n  }\n\n  override fun onCreate() {`,
  );
}

function wrapLoadReactNative(src) {
  if (src.includes('MainApplication.loadReactNative ok')) return src;
  return src.replace(
    /loadReactNative\(\s*this\s*\)/,
    `android.util.Log.e("${MARK}", "MainApplication.loadReactNative begin")
    try { com.kaibairen.startup.StartupLog.write(this, "MainApplication.loadReactNative begin") } catch (_: Throwable) {}
    try {
      loadReactNative(this)
      android.util.Log.e("${MARK}", "MainApplication.loadReactNative ok")
      try { com.kaibairen.startup.StartupLog.write(this, "MainApplication.loadReactNative ok") } catch (_: Throwable) {}
      try { com.kaibairen.startup.StartupLog.installHandler(this) } catch (_: Throwable) {}
    } catch (error: Throwable) {
      android.util.Log.e("${MARK}", "MainApplication.loadReactNative fail " + error)
      try { com.kaibairen.startup.StartupLog.showAndDie(this, "MainApplication.loadReactNative fail", error) } catch (_: Throwable) {}
      throw error
    }`,
  );
}

function injectAfterCall(src, call, message, contextExpr) {
  if (src.includes(message)) return src;
  if (!src.includes(call)) return src;
  return src.replace(call, `${call}\n    ${logStmt(message, contextExpr)}`);
}

function applyMainApplication(src) {
  let next = src;
  next = injectAttachBaseContext(next);
  next = injectCrashProcessGuard(next);
  next = injectAfterOnCreate(next, 'MainApplication.onCreate begin', 'this');
  next = wrapLoadReactNative(next);
  next = injectAfterCall(
    next,
    'ApplicationLifecycleDispatcher.onApplicationCreate(this)',
    'MainApplication.lifecycle ok',
    'this',
  );
  return next;
}

function applyMainActivity(src) {
  let next = injectAfterOnCreate(src, 'MainActivity.onCreate begin', 'this');
  next = injectAfterCall(next, 'super.onCreate(null)', 'MainActivity.super.onCreate ok', 'this');
  if (next === src || !next.includes('MainActivity.super.onCreate ok')) {
    next = injectAfterCall(next, 'super.onCreate(savedInstanceState)', 'MainActivity.super.onCreate ok', 'this');
  }
  return next;
}

function withStartupLog(config) {
  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = applyMainApplication(mod.modResults.contents);
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    mod.modResults.contents = applyMainActivity(mod.modResults.contents);
    return mod;
  });
  return config;
}

module.exports = withStartupLog;
module.exports.applyMainApplication = applyMainApplication;
module.exports.applyMainActivity = applyMainActivity;
