const https = require('https');
const { URL } = require('url');

const PREFIX = '/cursor-api';
const ARTIFACT_MAX_BYTES = 2 * 1024 * 1024;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function isAllowedArtifactHost(hostname) {
  const host = hostname.toLowerCase();
  return (
    host === 'amazonaws.com' ||
    host.endsWith('.amazonaws.com') ||
    host === 'cursor.com' ||
    host.endsWith('.cursor.com') ||
    host === 'cursor.sh' ||
    host.endsWith('.cursor.sh') ||
    host.endsWith('.cloudfront.net')
  );
}

function proxyArtifact(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { message: '只支持 GET' });
    return;
  }

  const incoming = new URL(req.url || '/', 'http://127.0.0.1');
  const target = incoming.searchParams.get('url');
  if (!target) {
    json(res, 400, { message: '缺少 url' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    json(res, 400, { message: '无效的文件地址' });
    return;
  }

  if (parsed.protocol !== 'https:' || !isAllowedArtifactHost(parsed.hostname)) {
    json(res, 403, { message: '不允许打开这个地址' });
    return;
  }

  const upstream = https.request(
    {
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      headers: { accept: '*/*' },
    },
    (up) => {
      const length = Number(up.headers['content-length'] || 0);
      if (length > ARTIFACT_MAX_BYTES) {
        up.resume();
        json(res, 413, { message: '文件太大，没法在应用里打开' });
        return;
      }

      const chunks = [];
      let size = 0;
      up.on('data', (chunk) => {
        size += chunk.length;
        if (size > ARTIFACT_MAX_BYTES) {
          up.destroy();
          if (!res.headersSent) {
            json(res, 413, { message: '文件太大，没法在应用里打开' });
          }
          return;
        }
        chunks.push(chunk);
      });
      up.on('end', () => {
        if (res.headersSent) return;
        res.writeHead(up.statusCode || 502, {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        res.end(Buffer.concat(chunks));
      });
    },
  );

  upstream.on('error', () => {
    if (!res.headersSent) {
      json(res, 502, { message: '无法读取文件内容' });
    }
  });
  upstream.end();
}

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
    const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
    if (pathname === `${PREFIX}/artifact`) {
      proxyArtifact(req, res);
      return;
    }
    if (pathname.startsWith(`${PREFIX}/`) || pathname === PREFIX) {
      proxyCursorApi(req, res);
      return;
    }
    return metroMiddleware(req, res, next);
  };
}

module.exports = { attachCursorApiProxy, PREFIX };
