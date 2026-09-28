/**
 * HLS/FLV Proxy for Kinora.
 *
 * Runs on your computer (Node.js). The Android app points to this IP.
 *
 * Usage:
 *   1. Copy this file to your computer
 *   2. npm install (no deps needed, uses built-in modules)
 *   3. node hls-proxy.js
 *   4. Set the proxy URL in Kinora settings to http://YOUR_COMPUTER_LAN_IP:3001/api/stream
 *
 * The proxy:
 *   - Adds Referer/User-Agent headers the stream host demands
 *   - Rewrites HLS manifests so every segment/key/map goes through the proxy
 *   - Streams segments with Range support
 *   - Returns Access-Control-Allow-Origin: *
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const FORWARDABLE = new Set([
  'user-agent', 'referer', 'origin', 'accept', 'accept-language',
  'cookie', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  'x-requested-with'
]);

const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;

function b64urlEncode(v) { return Buffer.from(String(v), 'utf8').toString('base64url'); }
function b64urlDecode(v) { return Buffer.from(String(v), 'base64url').toString('utf8'); }

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
}

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
  if (isPrivateHost(target.hostname)) throw Object.assign(new Error('Private address blocked'), { code: 'EBLOCKED' });
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(target.hostname)) return;
  try {
    const records = await require('dns').promises.lookup(target.hostname, { all: true });
    for (const r of records) if (isPrivateHost(r.address)) throw Object.assign(new Error('Private address blocked'), { code: 'EBLOCKED' });
  } catch (e) { if (e?.code === 'EBLOCKED') throw e; }
}

function resolveRef(ref, base) {
  try { return new URL(ref, base).href; } catch { return null; }
}

function rewriteManifest(text, baseUrl, referer) {
  const resolve = (ref) => {
    const abs = resolveRef(ref, baseUrl);
    if (!abs || !/^https?:/.test(abs)) return null;
    return abs;
  };
  return text.split(/\r?\n/).map((raw) => {
    const line = raw.trim();
    if (!line) return raw;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/gi, (whole, ref) => {
        const abs = resolve(ref);
        return abs ? `URI="/api/stream?u=${b64urlEncode(abs)}${referer ? '&r=' + b64urlEncode(referer) : ''}"` : whole;
      });
    }
    const abs = resolve(line);
    return abs ? `/api/stream?u=${b64urlEncode(abs)}${referer ? '&r=' + b64urlEncode(referer) : ''}` : line;
  }).join('\n').replace(/\n*$/, '\n');
}

function looksLikeManifest(url, ct) {
  return /\.m3u8(\?|$)/i.test(url) || /mpegurl|m3u8/i.test(String(ct || ''));
}

function b64urlEncode(v) { return Buffer.from(String(v), 'utf8').toString('base64url'); }
function b64urlDecode(v) { return Buffer.from(String(v), 'base64url').toString('utf8'); }

async function handleProxy(req, res, query) {
  setCors(res);
  const encoded = query.get('u');
  if (!encoded) return res.writeHead(400).end(JSON.stringify({ error: 'missing url' }));

  let target, referer = '';
  try {
    target = new URL(b64urlDecode(encoded));
    referer = query.get('r') ? b64urlDecode(query.get('r')) : '';
  } catch {
    return res.writeHead(400).end(JSON.stringify({ error: 'bad url' }));
  }

  await assertPublicTarget(target);

  const headers = { Accept: '*/*' };
  for (const [k, v] of Object.entries(req.headers)) {
    if (FORWARDABLE.has(k.toLowerCase()) && typeof v === 'string') headers[k] = v;
  }
  if (referer) headers.Referer = referer;
  else if (!headers.Referer) headers.Referer = target.origin + '/';
  if (req.headers.range) headers.Range = req.headers.range;

  const client = target.protocol === 'https:' ? https : http;
  const upstream = client.request(target, { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers, timeout: 20000 }, (up) => {
    const status = up.statusCode || 502;
    const ct = String(up.headers['content-type'] || '');
    if (status >= 400) { up.resume(); return res.writeHead(502).end(JSON.stringify({ error: 'upstream ' + status })); }

    if (looksLikeManifest(target.href, ct)) {
      const chunks = []; let size = 0, aborted = false;
      up.on('data', (c) => { size += c.length; if (size > MAX_MANIFEST_BYTES) { aborted = true; up.destroy(); } chunks.push(c); });
      up.on('end', () => { if (aborted) return; const body = rewriteManifest(Buffer.concat(chunks).toString(), target.href, referer); res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(body); });
      up.on('error', () => { if (!aborted && !res.headersSent) res.writeHead(502).end(JSON.stringify({ error: 'stream error' })); });
      return;
    }
    const hdrs = { 'Content-Type': ct || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
    ['content-length', 'content-range', 'accept-ranges'].forEach((n) => up.headers[n] && (hdrs[n] = up.headers[n]));
    res.writeHead(status, hdrs);
    up.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy());
  upstream.on('error', (e) => { if (!res.headersSent) res.writeHead(502).end(JSON.stringify({ error: e.message })); });
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') return setCors(res), res.writeHead(204).end();
  if (url.pathname === '/api/health') return setCors(res), res.writeHead(200).end(JSON.stringify({ ok: true }));
  if (url.pathname === '/api/stream') return handleProxy(req, res, url.searchParams);
  res.writeHead(404).end('Not found');
});

server.on('error', (e) => { if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} in use`); else console.error(e); process.exit(1); });
server.listen(PORT, HOST, () => console.log(`HLS proxy on http://${HOST}:${PORT} (api/stream)`));

function setCors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept'); res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type'); }