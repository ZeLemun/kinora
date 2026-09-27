/**
 * Zero-dependency static server + HLS/FLV proxy for the movie site.
 *
 * Why the proxy exists
 * --------------------
 * The free stream hosts used by the sports section cannot be played directly by
 * browser JavaScript:
 *
 *   1. "direct" servers  -> answer HTTP 403 and send NO Access-Control-Allow-Origin
 *   2. "referer" servers -> answer 200, but only when the request carries a specific
 *                           Referer, and they echo that Referer back in
 *                           Access-Control-Allow-Origin. A page on http://localhost
 *                           is a different origin, so hls.js is blocked.
 *
 * Browsers forbid JavaScript from forging the Referer header, so a server-side hop
 * is the only correct way to play these. This process:
 *
 *   - injects the Referer / User-Agent the stream host demands
 *   - re-answers with `Access-Control-Allow-Origin: *`
 *   - rewrites HLS playlists so every segment, key, map and variant is fetched
 *     through the proxy as well (otherwise playback dies on the first segment)
 *   - streams non-manifest bodies straight through, honouring Range requests
 *
 * Run with:  npm start      (PORT / SPORT_PORT override the default 3000)
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const dns = require('dns');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.SPORT_PORT || process.env.PORT || 3000);
const HOST = process.env.SPORT_HOST || '0.0.0.0';

/* ------------------------------------------------------------------ helpers */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/** Headers we are willing to send upstream on behalf of the stream host. */
const FORWARDABLE = new Set([
  'user-agent', 'referer', 'origin', 'accept', 'accept-language',
  'cookie', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  'x-requested-with'
]);

/** Never buffer whole segments in memory. */
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;

function b64urlEncode(value) {
  return Buffer.from(String(value), 'utf8').toString('base64url');
}

function b64urlDecode(value) {
  return Buffer.from(String(value), 'base64url').toString('utf8');
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, Content-Type');
}

/** Block requests that would reach this machine or a private network. */
function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '0.0.0.0' || host === '::') return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const parts = host.split('.').map(Number);
    if (parts.some(p => p > 255)) return true;
  }
  return false;
}

async function assertPublicTarget(target) {
  if (isPrivateHost(target.hostname)) {
    const err = new Error('Refusing to proxy a private address');
    err.code = 'EBLOCKED';
    throw err;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(target.hostname)) return;
  try {
    const records = await dns.promises.lookup(target.hostname, { all: true });
    for (const record of records) {
      if (isPrivateHost(record.address)) {
        const err = new Error('Refusing to proxy a private address');
        err.code = 'EBLOCKED';
        throw err;
      }
    }
  } catch (err) {
    if (err.code === 'EBLOCKED') throw err;
    // DNS hiccup: let the real request surface the problem.
  }
}

/**
 * Build the proxied form of `absoluteUrl`, carrying the same Referer for every
 * nested request the player makes (manifests, segments, keys, variants).
 */
function proxyUrlFor(absoluteUrl, referer) {
  const params = new URLSearchParams();
  params.set('u', b64urlEncode(absoluteUrl));
  if (referer) params.set('r', b64urlEncode(referer));
  return '/api/stream?' + params.toString();
}

/**
 * Rewrite an HLS playlist so hls.js only ever talks to our own origin.
 * Handles bare URI lines plus the URI="..." attributes used by tags.
 */
function rewriteManifest(text, manifestUrl, referer) {
  // Only http(s) resources can travel through the proxy. Anything else
  // (data:, blob:, a malformed token) must be left exactly as the provider
  // wrote it rather than turned into a guaranteed-404 proxy URL.
  const resolve = (ref) => {
    let absolute;
    try { absolute = new URL(ref, manifestUrl); } catch (_) { return null; }
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') return null;
    return absolute.href;
  };
  if (!String(text || '').trim()) return String(text == null ? '' : text);
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { out.push(rawLine); continue; }

    if (line.startsWith('#')) {
      // Rewrite every URI="..." attribute (KEY, MAP, MEDIA, I-FRAME-STREAM-INF, ...).
      out.push(line.replace(/URI="([^"]+)"/gi, (whole, ref) => {
        const abs = resolve(ref);
        return abs ? `URI="${proxyUrlFor(abs, referer)}"` : whole;
      }));
      continue;
    }

    const abs = resolve(line);
    out.push(abs ? proxyUrlFor(abs, referer) : line);
  }
  // Guarantee a trailing newline: some demuxers reject a playlist without one.
  return out.join('\n').replace(/\n*$/, '\n');
}

function looksLikeManifest(url, contentType) {
  if (/\.m3u8(\?|$)/i.test(url)) return true;
  return /mpegurl|m3u8/i.test(String(contentType || ''));
}

/* -------------------------------------------------------------- the proxy  */

async function handleStreamProxy(req, res, query) {
  setCors(res);

  const encoded = query.get('u');
  if (!encoded) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing target url' }));
    return;
  }

  let target;
  let referer = '';
  try {
    target = new URL(b64urlDecode(encoded));
    referer = query.get('r') ? b64urlDecode(query.get('r')) : '';
  } catch (_) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'malformed target url' }));
    return;
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unsupported protocol' }));
    return;
  }

  try {
    await assertPublicTarget(target);
  } catch (err) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
    return;
  }

  const upstreamHeaders = { Accept: '*/*' };
  for (const [name, value] of Object.entries(req.headers)) {
    if (FORWARDABLE.has(name.toLowerCase()) && typeof value === 'string') {
      upstreamHeaders[name] = value;
    }
  }
  // The stream host's Referer requirement is the whole point of this hop.
  if (referer) upstreamHeaders['Referer'] = referer;
  else if (!upstreamHeaders.referer && !upstreamHeaders.Referer) {
    upstreamHeaders['Referer'] = target.origin + '/';
  }
  if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;

  const client = target.protocol === 'https:' ? https : http;
  const upstream = client.request(target, {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: upstreamHeaders,
    timeout: 20000
  }, (upstreamRes) => {
    const status = upstreamRes.statusCode || 502;
    const contentType = String(upstreamRes.headers['content-type'] || '');
    const bodyless = status === 204 || status === 304;

    if (bodyless) {
      res.writeHead(status, { 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }

    // Upstream refusal: surface it as a clean 502 with a reason so the player can
    // fail over to the next server instead of hanging until its watchdog fires.
    if (status >= 400) {
      upstreamRes.resume();
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Upstream-Status': String(status)
      });
      res.end(JSON.stringify({
        error: 'upstream refused',
        upstream: status,
        target: target.hostname
      }));
      return;
    }

    if (looksLikeManifest(target.href, contentType)) {
      const chunks = [];
      let size = 0;
      let aborted = false;

      upstreamRes.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_MANIFEST_BYTES) {
          aborted = true;
          upstreamRes.destroy();
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'manifest too large' }));
          return;
        }
        chunks.push(chunk);
      });

      upstreamRes.on('end', () => {
        if (aborted) return;
        const rewritten = rewriteManifest(Buffer.concat(chunks).toString('utf8'), target.href, referer);
        const body = Buffer.from(rewritten, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': body.length,
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(body);
      });

      upstreamRes.on('error', () => {
        if (aborted) return;
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: 'upstream stream error' }));
      });
      return;
    }

    // Segments / keys / FLV bodies: pass through untouched, Range included.
    const headers = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    };
    ['content-length', 'content-range', 'accept-ranges'].forEach((name) => {
      if (upstreamRes.headers[name]) headers[name] = upstreamRes.headers[name];
    });
    res.writeHead(status, headers);
    upstreamRes.pipe(res);
  });

  upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
  upstream.on('error', (err) => {
    if (res.headersSent) { res.end(); return; }
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || 'upstream unreachable' }));
  });
  upstream.end();
}

/* ---------------------------------------------------------- static assets */

async function serveStatic(req, res, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch (_) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (relative.endsWith('/')) relative += 'index.html';

  const resolved = path.resolve(ROOT, '.' + relative);
  // Path traversal guard.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  if (stat.isDirectory()) {
    res.writeHead(302, { Location: relative.replace(/\/?$/, '/') + 'index.html' });
    res.end();
    return;
  }

  const ext = path.extname(resolved).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
    ETag: etag,
    // The proxy already handles CORS; this keeps dev tooling happy too.
    'Access-Control-Allow-Origin': '*'
  });

  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(resolved).pipe(res);
}

/* ------------------------------------------------------ scoreboard passthrough

   The football scoreboard is fetched here rather than by the page because the
   origin answers the two callers differently:

     - from Node it replies 200 with `Access-Control-Allow-Origin: *`
     - from a browser it replies 403 with no CORS header at all, so every
       league's fetch fails and the section falls back to a handful of
       fixture-less cards

   Chrome reports that as `MissingAllowOriginHeader`; a no-cors fetch reaches
   the network and is discarded unreadable. The block is on the edge and tracks
   the client fingerprint, so adding browser headers does not help.

   This endpoint is deliberately narrow. The upstream host is a constant, never
   taken from the query, and the only variable parts are the league code and an
   8-digit date, both of which are validated against a strict pattern and
   re-encoded into the URL. It therefore cannot be turned into an open proxy. */
const SCOREBOARD_ORIGIN = 'https://site.api.espn.com';
const SCOREBOARD_PATH = /^\/apis\/site\/v2\/sports\/soccer\/[a-z0-9.]+\/scoreboard$/;
// Two or three dot-separated lowercase alphanumeric segments, to cover both
// "eng.1" and "uefa.europa.conf". No slash, dot or percent can appear, so the
// value cannot climb out of its path position.
const SCOREBOARD_LEAGUE = /^[a-z0-9]{2,10}(?:\.[a-z0-9]{1,12}){1,2}$/;
const SCOREBOARD_DATES = /^\d{8}$/;
/** True for an 8-digit YYYYMMDD that is also a real day of the calendar. */
function isRealScoreboardDate(value) {
  if (!SCOREBOARD_DATES.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (year < 1970 || year > 2999 || month < 1 || month > 12) return false;
  // Day 0 of a month never exists, and a 31-day February is a typo, not a date.
  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const SCOREBOARD_TTL_MS = 60 * 1000;
const scoreboardCache = new Map();

/** Why a scoreboard request was refused. Surfaced to the page as `reason`. */
function scoreboardRefusal(league, dates) {
  if (!league) return 'missing league';
  if (!SCOREBOARD_LEAGUE.test(league)) return 'bad league code';
  // Eight digits is not enough: "00000000" and "99999999" pass a length check
  // and then come back as a silently empty league, which reads as "no matches
  // today" rather than as the bad input it is.
  if (dates && !isRealScoreboardDate(dates)) return 'bad dates';
  return '';
}

async function handleScoreboard(req, res, query) {
  const league = String(query.get('league') || '');
  const dates = String(query.get('dates') || '');
  const refusal = scoreboardRefusal(league, dates);
  if (refusal) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, reason: refusal }));
    return;
  }

  // Both values are re-validated above, so building the path from them cannot
  // escape SCOREBOARD_ORIGIN or inject a query of our own.
  const upstreamPath = `/apis/site/v2/sports/soccer/${league}/scoreboard`;
  if (!SCOREBOARD_PATH.test(upstreamPath)) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, reason: 'path rejected' }));
    return;
  }

  const url = new URL(upstreamPath, SCOREBOARD_ORIGIN);
  if (dates) url.searchParams.set('dates', dates);

  const key = url.href;
  const hit = scoreboardCache.get(key);
  if (hit && Date.now() - hit.ts < SCOREBOARD_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(hit.body);
    return;
  }

  let target;
  try {
    target = new URL(url.href);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, reason: 'bad url' }));
    return;
  }
  // Defence in depth: the host is a constant, but assert it anyway so a future
  // edit that parameterises the origin fails the SSRF guard rather than shipping.
  try {
    await assertPublicTarget(target);
  } catch (err) {
    res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, reason: 'blocked target' }));
    return;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 9000);
  try {
    const upstream = await fetch(url.href, {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    const body = await upstream.text();
    if (!upstream.ok) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: false, reason: 'upstream ' + upstream.status }));
      return;
    }
    // Only cache and relay something that really is JSON; an HTML error page
    // from an edge must not be stored as if it were a scoreboard.
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) { parsed = null; }
    if (!parsed || typeof parsed !== 'object') {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: false, reason: 'upstream not json' }));
      return;
    }
    if (scoreboardCache.size > 300) scoreboardCache.clear();
    scoreboardCache.set(key, { ts: Date.now(), body });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (err) {
    const aborted = err && (err.name === 'AbortError' || /abort/i.test(err.message || ''));
    res.writeHead(aborted ? 504 : 502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: false, reason: aborted ? 'timeout' : 'network' }));
  } finally {
    clearTimeout(timer);
  }
}

function handleTmdbProxy(req, res, pathname) {
  setCors(res);

  // Extract the TMDB path from /api/tmdb/...
  const tmdbPath = pathname.slice('/api/tmdb'.length);
  const tmdbKey = '2a5568baeef016cd5241440fab2767de';
  const tmdbBase = 'https://api.themoviedb.org/3';

  const targetUrl = new URL(tmdbPath, tmdbBase);
  targetUrl.searchParams.set('api_key', tmdbKey);

  // Forward query parameters except api_key
  const clientUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  for (const [key, value] of clientUrl.searchParams) {
    if (key !== 'api_key') {
      targetUrl.searchParams.set(key, value);
    }
  }

  // Add common headers
  const headers = {
    'Accept': 'application/json',
    'User-Agent': req.headers['user-agent'] || 'Kinora/1.0',
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  fetch(targetUrl, {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    signal: controller.signal,
  })
    .then((upstream) => {
      clearTimeout(timeout);

      // Forward response headers
      const contentType = upstream.headers.get('content-type') || 'application/json';
      const cacheControl = upstream.headers.get('cache-control') || 'no-store';

      res.writeHead(upstream.status, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept',
      });

      if (upstream.body) {
        // Node.js 18+ has fetch with body as a ReadableStream
        const reader = upstream.body.getReader();
        function pump() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              res.end();
              return;
            }
            res.write(value);
            return pump();
          });
        }
        pump().catch((err) => {
          if (!res.writableEnded) {
            res.end();
          }
        });
      } else {
        res.end();
      }
    })
    .catch((err) => {
      clearTimeout(timeout);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ ok: false, reason: 'network' }));
      }
    });
}

/* --------------------------------------------------------------- routing  */

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/health') {
      setCors(res);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, proxy: '/api/stream', scores: '/api/scoreboard', app: 'movie-site' }));
      return;
    }

    if (pathname === '/api/scoreboard') {
      await handleScoreboard(req, res, parsed.searchParams);
      return;
    }

    if (pathname === '/api/stream') {
      await handleStreamProxy(req, res, parsed.searchParams);
      return;
    }

    if (pathname.startsWith('/api/tmdb/')) {
      await handleTmdbProxy(req, res, pathname);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal error');
  }
});

/* Only bind a socket when this file is the process entry point. proxy-test.js
   requires this module to unit test the playlist rewriter, and an unconditional
   listen() would make the test suite fight the running dev server for the port
   (and, with the EADDRINUSE handler below, exit the whole test run). */
if (require.main === module) {
  /* An unhandled 'error' event dumps a raw Node stack trace, which tells the
     user nothing about what to do next. The overwhelmingly common cause is a
     previous copy of this server still running, so name it and say how to fix
     it. */
  server.on('error', err => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${PORT} is already in use, so the server did not start.`);
      console.error('  Another copy of this server is probably still running.\n');
      console.error('  Either stop it (find it with:  netstat -ano | findstr :' + PORT);
      console.error('  then kill it with:             taskkill /PID <pid> /F),');
      console.error('  or start this one on a different port:  set SPORT_PORT=3001 && node server.js\n');
    } else if (err && err.code === 'EACCES') {
      console.error(`\n  Not allowed to listen on port ${PORT}.`);
      console.error('  Ports below 1024 need elevated rights; try a port above 1024.\n');
    } else {
      console.error('\n  Server error: ' + (err && err.message ? err.message : String(err)) + '\n');
    }
    process.exit(1);
  });

  server.listen(PORT, HOST, () => {
    console.log(`\n  Kinora server running at http://localhost:${PORT}`);
    console.log(`  Stream proxy ready    at http://localhost:${PORT}/api/stream`);
    console.log(`  TMDB proxy ready      at http://localhost:${PORT}/api/tmdb/...`);
    console.log('  Press Ctrl+C to stop.\n');
  });
}

/* Exported so the playlist rewriter can be unit tested without a socket. */
module.exports = { server, rewriteManifest, proxyUrlFor, b64urlEncode, b64urlDecode, isPrivateHost, scoreboardRefusal };
