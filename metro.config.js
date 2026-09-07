const { getDefaultConfig } = require('expo/metro-config');
const { attachCursorApiProxy } = require('./scripts/cursor-api-proxy');

const config = getDefaultConfig(__dirname);
config.resolver = config.resolver ?? {};
const previousResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'android' && (moduleName === 'expo-video' || moduleName.startsWith('expo-video/'))) {
    return { type: 'empty' };
  }
  if (previousResolve) {
    return previousResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const previous = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const next = previous ? previous(middleware, server) : middleware;
    return attachCursorApiProxy(next);
  },
};

module.exports = config;
