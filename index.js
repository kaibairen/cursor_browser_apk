console.log('[AgentsStartup] js-bundle-start');
try {
  require('./src/lib/startupLog').logStartup('js-bundle-start');
} catch (error) {
  console.log('[AgentsStartup] js-bundle-start-failed', error && error.message);
}
require('expo-router/entry');
