const { getDefaultConfig } = require('expo/metro-config');
const { attachCursorApiProxy } = require('./scripts/cursor-api-proxy');

const config = getDefaultConfig(__dirname);
const previous = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const next = previous ? previous(middleware, server) : middleware;
    return attachCursorApiProxy(next);
  },
};

module.exports = config;
