const https = require('https');
const { URL } = require('url');

const PREFIX = '/cursor-api';

function proxyCursorApi(req, res) {
  const incoming = new URL(req.url || '/', 'http://127.0.0.1');
  if (!incoming.pathname.startsWith(PREFIX)) {
    res.statusCode = 404;
    res.end();
    return;
  }

  const targetPath = `${incoming.pathname.slice(PREFIX.length) || '/'}${incoming.search}`;
  const headers = {};
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  if (req.headers.accept) headers.accept = req.headers.accept;
  if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
  if (req.headers['last-event-id']) headers['last-event-id'] = req.headers['last-event-id'];

  const upstream = https.request(
    {
      hostname: 'api.cursor.com',
      path: targetPath,
      method: req.method,
      headers,
    },
    (up) => {
      const outHeaders = {
        'cache-control': 'no-store',
      };
      if (up.headers['content-type']) outHeaders['content-type'] = up.headers['content-type'];
      res.writeHead(up.statusCode || 502, outHeaders);
      up.pipe(res);
    },
  );

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ message: '无法连接 Cursor API' }));
  });

  req.pipe(upstream);
}

function attachCursorApiProxy(metroMiddleware) {
  return function cursorApiMiddleware(req, res, next) {
    const path = req.url || '';
    if (path.startsWith(`${PREFIX}/`) || path === PREFIX) {
      proxyCursorApi(req, res);
      return;
    }
    return metroMiddleware(req, res, next);
  };
}

module.exports = { attachCursorApiProxy, PREFIX };
