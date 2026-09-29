/**
 * Embed providers — iframe-based players from streaming sites.
 *
 * These are the same providers the "movie site" uses:
 *   vidsrc.to, superembed (multiembed.mov), vidapi (vaplayer.ru)
 *
 * `superembed_vip` was removed after checking it: `directstream.php` answers
 * 404 for every id, so it offered a source that could never work.
 *
 * They return an embed URL that goes in an <iframe>. The actual video
 * plays inside that iframe, bypassing CORS/Referer blocks because the
 * iframe's origin is the streaming site itself.
 *
 * No API key needed. Works from the browser directly.
 */

export interface EmbedProvider {
  id: string;
  name: string;
  movie: (tmdbId: number, imdbId?: string) => string;
  tv: (tmdbId: number, season: number, episode: number, imdbId?: string) => string;
  /** True if the embed supports subtitles/audio tracks via its own UI. */
  hasTracks?: boolean;
  /**
   * Set when the provider is keyed on IMDb rather than TMDB. It still receives
   * the TMDB id, and falls back to it if OMDb never supplied an IMDb one —
   * SuperEmbed accepts either and resolves client-side, so a wrong-looking id
   * is not detectable server-side.
   */
  imdbKeyed?: boolean;
  /**
   * Query fragment appended so playback starts without a tap.
   *
   * Most of these accept `autoplay=1`; VidCore documents `autoplay=true`, so
   * the value is per-provider rather than hard-coded. The <iframe> also needs
   * `allow="autoplay"` — without it the browser refuses regardless of what the
   * page asks for, which looks exactly like a provider that ignored the flag.
   *
   * Set to `false` for a provider that does not support it; an unsupported
   * parameter is ignored by most, but it is not worth sending blind.
   */
  autoplay?: string | false;
}

/**
 * Providers, in the order the chooser offers them.
 *
 * Every entry here was probed before being added; see the notes on the ones
 * that behave unexpectedly. `superembed_vip` was removed after
 * `directstream.php` answered 404 for every id.
 */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    /*
     * First by preference, not by hope.
     *
     * VidCore is the one that reliably produced a <video> while testing: it
     * resolved a source for titles where vidsrc answered "This media is
     * unavailable", and it documents its own autoplay flag. VidSrc's chain
     * (vidsrc.to -> vsembed.ru -> a third host) is the one that most often
     * resolved to nothing, so it is demoted rather than removed — it still wins
     * on titles the others miss.
     */
    id: 'vidcore',
    name: 'VidCore',
    movie: (id) => `https://vidcore.org/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidcore.org/embed/tv/${id}/${s}/${e}`,
    hasTracks: true,
    // Documented by the provider itself as `?autoplay=true`.
    autoplay: 'autoplay=true',
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    hasTracks: true,
  },
  {
    id: 'superembed',
    name: 'SuperEmbed',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    hasTracks: true,
  },
  {
    id: 'vidapi',
    name: 'VidAPI',
    movie: (id) => `https://vaplayer.ru/embed/movie/${id}`,
    tv: (id, s, e) => `https://vaplayer.ru/embed/tv/${id}/${s}/${e}`,
    hasTracks: false,
  },
  {
    id: 'embed2',
    name: '2Embed',
    // Keyed on IMDb, which it prefers, but it accepts a TMDB id too — verified
    // against both. Note the host: 2embed.online 301s to 2embed.stream, and it
    // is that host which then has to be allowed to navigate in-app.
    movie: (id, imdbId) => `https://www.2embed.online/embed/movie/${imdbId ?? id}`,
    tv: (id, s, e, imdbId) => `https://www.2embed.online/embed/tv/${imdbId ?? id}/${s}/${e}`,
    imdbKeyed: true,
    hasTracks: false,
  },
  {
    id: 'superembed_stream',
    name: 'SuperEmbed Stream',
    // Returns an identical 3986-byte shell for a valid id, an invalid id and no
    // id at all — it resolves the title client-side, so a 200 here proves only
    // that the page exists, never that the id is good.
    movie: (id, imdbId) => `https://www.superembed.stream/dooplay.html?imdb=${imdbId ?? id}`,
    tv: (id, s, e, imdbId) =>
      `https://www.superembed.stream/dooplay.html?imdb=${imdbId ?? id}&season=${s}&episode=${e}`,
    imdbKeyed: true,
    hasTracks: false,
  },
];

/** All providers, in priority order. */
export function getEmbedSources(
  media: { id: number; type: 'movie' | 'tv'; imdbId?: string },
  season?: number,
  episode?: number
): { provider: EmbedProvider; url: string }[] {
  return EMBED_PROVIDERS.map((p) => ({
    provider: p,
    url:
      media.type === 'movie'
        ? p.movie(media.id, media.imdbId)
        : p.tv(media.id, season ?? 1, episode ?? 1, media.imdbId),
  }));
}

/** A single "best effort" embed — the first provider in the list. */
export function getPrimaryEmbed(media: { id: number; type: 'movie' | 'tv' }, season?: number, episode?: number): string {
  const p = EMBED_PROVIDERS[0];
  return media.type === 'movie' ? p.movie(media.id) : p.tv(media.id, season ?? 1, episode ?? 1);
}

/**
 * Adds a provider's autoplay flag to a URL built by `getEmbedSources`.
 *
 * Kept separate from the builders so the URL that is *offered* in the source
 * list stays the plain embed URL — the flag is a presentation concern of the
 * player, and baking it in meant the chooser advertised URLs the app never used.
 */
export function withAutoplay(url: string, providerId: string): string {
  const provider = EMBED_PROVIDERS.find((p) => p.id === providerId);
  const flag = provider?.autoplay === undefined ? 'autoplay=1' : provider.autoplay;
  if (!flag) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${flag}`;
}