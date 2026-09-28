import type {
  CatalogResponse,
  Manifest,
  MetaResponse,
  StreamResponse,
  SubtitleResponse,
  InstalledAddon,
} from '../addon-types';

/**
 * Direct Stremio add-on protocol (addon v3) client.
 *
 * We deliberately do NOT use @stremio/stremio-core-web: it is a CommonJS
 * wasm-bindgen module whose entry point is a low-level start()/dispatch() RPC
 * bridge, not the `default()` factory one would assume. Driving it from a
 * WebView adds a worker + WASM for no benefit when the protocol is six GETs.
 */
export class AddonTransport {
  readonly manifest: Manifest;
  readonly transportUrl: string;
  readonly config: Record<string, unknown>;

  constructor(manifest: Manifest, transportUrl: string, config: Record<string, unknown> = {}) {
    this.manifest = manifest;
    this.transportUrl = transportUrl;
    this.config = config;
  }

  private url(resource: string, params: Record<string, string | number | undefined> = {}) {
    const base = this.transportUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/${resource}`);

    // Add-on config travels as query params, which is what every debrid
    // add-on expects (e.g. ?debridToken=…, ?debridService=…).
    for (const [key, value] of Object.entries(this.config)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, typeof value === 'boolean' ? String(value) : String(value));
    }
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Add-on responded ${res.status}`);
    }
    return (await res.json()) as T;
  }

  catalog(
    type: string,
    id: string,
    extra?: Record<string, string | number | undefined>
  ): Promise<CatalogResponse> {
    return this.json<CatalogResponse>(this.url(`catalog/${type}/${encodeURIComponent(id)}.json`, extra));
  }

  meta(type: string, id: string): Promise<MetaResponse> {
    return this.json<MetaResponse>(this.url(`meta/${type}/${encodeURIComponent(id)}.json`));
  }

  stream(type: string, id: string): Promise<StreamResponse> {
    return this.json<StreamResponse>(this.url(`stream/${type}/${encodeURIComponent(id)}.json`));
  }

  subtitles(
    type: string,
    id: string,
    extra?: Record<string, string | number | undefined>
  ): Promise<SubtitleResponse> {
    return this.json<SubtitleResponse>(
      this.url(`subtitles/${type}/${encodeURIComponent(id)}.json`, extra)
    );
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

/** Normalise a persisted add-on record into a transport client. */
export function toTransport(addon: InstalledAddon): AddonTransport {
  return new AddonTransport(addon.manifest, addon.transportUrl, addon.config ?? {});
}

/** Does this add-on declare a resource? Handles both spec shapes. */
export function resourceNames(manifest: Manifest): string[] {
  return (manifest.resources ?? [])
    .map((r) => (typeof r === 'string' ? r : r.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

/** Does this add-on handle ids like ours ("tt1234567")? */
export function acceptsId(manifest: Manifest, id: string): boolean {
  const prefixes = manifest.idPrefixes;
  if (!prefixes || prefixes.length === 0) return true;
  return prefixes.some((p) => id.startsWith(p));
}

export function isEnabled(addon: InstalledAddon): boolean {
  return addon.enabled !== false;
}

/**
 * Can a WebView actually play this stream?
 *
 * A source only counts if it is a direct HTTP(S) URL. We also reject the
 * error placeholders add-ons return when their providers fail (MediaFusion and
 * friends serve `/static/exceptions/…`) and magnet links, which need a torrent
 * engine rather than a <video> element.
 */
export function isProbablyPlayable(stream: { url?: string; behaviorHints?: { notWebReady?: boolean } }): boolean {
  if (stream.behaviorHints?.notWebReady) return false;
  const url = stream.url;
  if (typeof url !== 'string' || url.length === 0) return false;
  if (/^magnet:/i.test(url) || /^infohash:/i.test(url)) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\/static\/exceptions\//i.test(url)) return false;
  return true;
}

/** Fetch a manifest, tolerating a URL that already points at the JSON. */
export async function fetchManifest(rawUrl: string): Promise<Manifest> {
  let url = rawUrl.trim();
  if (url.startsWith('stremio://')) {
    url = decodeURIComponent(url.slice('stremio://'.length));
  }
  if (!url) throw new Error('Empty URL');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Add-on responded ${res.status}`);
    const manifest = (await res.json()) as Manifest;
    if (!manifest?.id || !Array.isArray(manifest.resources)) {
      throw new Error('Not a valid add-on manifest');
    }
    return {
      ...manifest,
      types: Array.isArray(manifest.types) ? manifest.types : [],
      resources: manifest.resources,
    };
  } finally {
    clearTimeout(timer);
  }
}
