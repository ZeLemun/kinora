import type { MediaSource } from '../store/app-store';

/**
 * Source health checking.
 *
 * A `MediaSource` is just a URL, and a URL that resolved yesterday 404s today.
 * Before handing one to <video> it is worth spending a few hundred milliseconds
 * asking the host whether the bytes are actually there, because the player has
 * no way to recover once <video> has already failed.
 *
 * The subtlety that matters: a *network* failure from `fetch` is usually CORS,
 * not a dead link. A <video> without a `crossOrigin` attribute is not subject
 * to a CORS check, so a source that `fetch` cannot read may still play
 * perfectly. Those are reported as "unknown" and kept, just ranked lower.
 */

export type ProbeState = 'pending' | 'testing' | 'ok' | 'unknown' | 'failed';

export interface Probe {
  state: ProbeState;
  /** Human-readable note shown next to the source. */
  note?: string;
  /** Content-Length when the server volunteers it, in bytes. */
  size?: number;
}

export const RANK: Record<ProbeState, number> = {
  ok: 3,
  unknown: 2,
  testing: 1,
  pending: 0,
  failed: -1,
};

const QUALITY_SCORE: Record<string, number> = {
  '2160p': 60,
  '4k': 60,
  '1440p': 50,
  '1080p': 40,
  '720p': 30,
  '480p': 20,
  '360p': 15,
  sd: 10,
  trailer: 1,
  hd: 40,
};

export const qualityScore = (s: MediaSource) =>
  QUALITY_SCORE[(s.quality ?? 'sd').toLowerCase()] ?? 10;

/**
 * Ask the host whether this URL serves video. Never throws.
 *
 * Only the first kilobyte is requested, and the body is dropped immediately —
 * this is a liveness check, not a download.
 */
export async function probeSource(source: MediaSource, signal?: AbortSignal): Promise<Probe> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  // Do not let one unresponsive host hold the whole chooser hostage.
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(source.url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1023' },
      signal: controller.signal,
      cache: 'no-store',
    });

    // Release the socket straight away; we only wanted the headers.
    void res.body?.cancel().catch(() => undefined);

    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    const lengthHeader = res.headers.get('content-length');
    const size = lengthHeader ? Number(lengthHeader) : undefined;

    if (!res.ok && res.status !== 206) {
      return { state: 'failed', note: `Server said ${res.status}` };
    }

    // Some CDNs answer a range request with the whole body and no type.
    const looksLikeVideo =
      type.startsWith('video/') ||
      type === 'application/octet-stream' ||
      res.headers.has('accept-ranges');

    if (looksLikeVideo) {
      const mb = size && size > 0 ? ` · ${(size / 1_000_000).toFixed(0)} MB` : '';
      return { state: 'ok', size, note: `${type || 'video'}${mb}` };
    }

    return { state: 'failed', note: type ? `Not a video (${type})` : 'Not a video' };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { state: 'unknown', note: 'Timed out' };
    }
    // Almost always CORS: keep the source, just rank it below a verified one.
    return { state: 'unknown', note: 'Could not verify' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Best first: verified beats unverified, then quality, then file size. */
export function rankSources(
  sources: MediaSource[],
  probes: Record<string, Probe>
): MediaSource[] {
  return [...sources].sort((a, b) => {
    const pa = RANK[probes[a.url]?.state ?? 'pending'];
    const pb = RANK[probes[b.url]?.state ?? 'pending'];
    if (pa !== pb) return pb - pa;
    const qa = qualityScore(a);
    const qb = qualityScore(b);
    if (qa !== qb) return qb - qa;
    return (probes[b.url]?.size ?? 0) - (probes[a.url]?.size ?? 0);
  });
}

/** The first source worth handing to <video>. */
export function bestSource(
  sources: MediaSource[],
  probes: Record<string, Probe>
): MediaSource | undefined {
  if (sources.length === 0) return undefined;
  return rankSources(sources, probes)[0];
}
