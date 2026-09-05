const https = require('https');
const { URL } = require('url');

const PREFIX = '/cursor-api';
const ARTIFACT_MAX_BYTES = 2 * 1024 * 1024;

function json(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  if (res.headersSent) {
    try {
      res.end();
    } catch {
      // already closed
    }
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function writeSseChunk(res, chunk) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(chunk);
    if (typeof res.flush === 'function') res.flush();
    return true;
  } catch {
    return false;
  }
}

function destroyQuietly(stream) {
  if (!stream || stream.destroyed) return;
  try {
    stream.destroy();
  } catch {
    // ignore
  }
}

function watchClientAbort(req, res, abort) {
  const once = () => abort();
  req.on('aborted', once);
  req.on('close', once);
  res.on('close', once);
  res.on('error', once);
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

  let upstream;
  const abort = () => destroyQuietly(upstream);
  watchClientAbort(req, res, abort);

  try {
    upstream = https.request(
      {
        hostname: 'api.cursor.com',
        path: targetPath,
        method: req.method,
        headers,
      },
      (up) => {
        const isSse =
          /text\/event-stream/i.test(String(up.headers['content-type'] || '')) ||
          targetPath.includes('/stream');
        const outHeaders = {
          'cache-control': isSse ? 'no-cache, no-transform' : 'no-store',
        };
        if (isSse) {
          outHeaders['content-type'] = 'text/event-stream; charset=utf-8';
          outHeaders.connection = 'keep-alive';
          outHeaders['x-accel-buffering'] = 'no';
        } else if (up.headers['content-type']) {
          outHeaders['content-type'] = up.headers['content-type'];
        }
        if (res.writableEnded || res.destroyed) {
          destroyQuietly(up);
          return;
        }
        res.writeHead(up.statusCode || 502, outHeaders);
        if (typeof res.flushHeaders === 'function') res.flushHeaders();
        if (!isSse) {
          up.on('error', abort);
          res.on('error', abort);
          up.pipe(res);
          return;
        }
        up.on('data', (chunk) => {
          if (!writeSseChunk(res, chunk)) destroyQuietly(up);
        });
        up.on('end', () => {
          if (!res.writableEnded) {
            try {
              res.end();
            } catch {
              // ignore
            }
          }
        });
        up.on('error', () => {
          destroyQuietly(up);
          if (!res.writableEnded) {
            try {
              res.end();
            } catch {
              // ignore
            }
          }
        });
      },
    );
  } catch {
    json(res, 502, { message: '无法连接 Cursor API' });
    return;
  }

  upstream.on('error', () => {
    if (!res.headersSent) {
      json(res, 502, { message: '无法连接 Cursor API' });
      return;
    }
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  });

  req.pipe(upstream);
}

function parseGithubPr(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !/^(www\.)?github\.com$/i.test(parsed.hostname)) {
    return null;
  }
  const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/pulls?\/(\d+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, ''), number: match[3] };
}

function proxyGithubPr(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    json(res, 405, { message: '只支持 GET' });
    return;
  }
  const incoming = new URL(req.url || '/', 'http://127.0.0.1');
  const parsed = parseGithubPr(incoming.searchParams.get('url') || '');
  if (!parsed) {
    json(res, 400, { message: '无效的 PR 地址' });
    return;
  }

  const upstream = https.request(
    {
      hostname: 'api.github.com',
      path: `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'agents-console',
      },
    },
    (up) => {
      const chunks = [];
      up.on('data', (chunk) => chunks.push(chunk));
      up.on('end', () => {
        if (res.headersSent) return;
        if ((up.statusCode || 502) >= 400) {
          json(res, up.statusCode || 502, { message: '无法读取 PR' });
          return;
        }
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          json(res, 200, {
            additions: Number(body.additions) || 0,
            deletions: Number(body.deletions) || 0,
          });
        } catch {
          json(res, 502, { message: '无法读取 PR' });
        }
      });
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) json(res, 502, { message: '无法连接 GitHub' });
  });
  upstream.end();
}

function attachCursorApiProxy(metroMiddleware) {
  return function cursorApiMiddleware(req, res, next) {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      if (pathname === `${PREFIX}/artifact`) {
        proxyArtifact(req, res);
        return;
      }
      if (pathname === `${PREFIX}/github-pr`) {
        proxyGithubPr(req, res);
        return;
      }
      if (pathname.startsWith(`${PREFIX}/`) || pathname === PREFIX) {
        proxyCursorApi(req, res);
        return;
      }
      return metroMiddleware(req, res, next);
    } catch {
      if (!res.headersSent && !res.writableEnded) {
        res.statusCode = 502;
        res.end();
      }
    }
  };
}

module.exports = { attachCursorApiProxy, PREFIX, writeSseChunk };
