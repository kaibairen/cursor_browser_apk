const { withMainActivity, withMainApplication } = require('@expo/config-plugins');

const MARK = 'AgentsStartup';

function injectAfterOnCreate(src, message) {
  if (src.includes(MARK) && src.includes(message)) return src;
  const kotlin = src.replace(
    /override fun onCreate\(\w*(?::\s*Bundle\?)?\)\s*\{/,
    (block) => `${block}\n    android.util.Log.e("${MARK}", "${message}")`,
  );
  if (kotlin !== src) return kotlin;
  return src.replace(
    /void onCreate\(Bundle\s+\w+\)\s*\{/,
    (block) => `${block}\n    android.util.Log.e("${MARK}", "${message}");`,
  );
}

function withStartupLog(config) {
  config = withMainApplication(config, (mod) => {
    mod.modResults.contents = injectAfterOnCreate(mod.modResults.contents, 'MainApplication.onCreate begin');
    return mod;
  });
  config = withMainActivity(config, (mod) => {
    mod.modResults.contents = injectAfterOnCreate(mod.modResults.contents, 'MainActivity.onCreate begin');
    return mod;
  });
  return config;
}

module.exports = withStartupLog;
