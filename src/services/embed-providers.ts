/**
 * Embed providers — iframe-based players from streaming sites.
 *
 * These are the same providers the "movie site" uses:
 *   vidsrc.to, superembed (multiembed.mov), vidapi.ru, superembed_vip
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
  movie: (tmdbId: number) => string;
  tv: (tmdbId: number, season: number, episode: number) => string;
  /** True if the embed supports subtitles/audio tracks via its own UI. */
  hasTracks?: boolean;
}

export const EMBED_PROVIDERS: EmbedProvider[] = [
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
    id: 'superembed_vip',
    name: 'SuperEmbed VIP',
    movie: (id) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    hasTracks: true,
  },
];

/** All providers, in priority order. */
export function getEmbedSources(media: { id: number; type: 'movie' | 'tv' }, season?: number, episode?: number): { provider: EmbedProvider; url: string }[] {
  return EMBED_PROVIDERS.map((p) => ({
    provider: p,
    url: media.type === 'movie' ? p.movie(media.id) : p.tv(media.id, season ?? 1, episode ?? 1),
  }));
}

/** A single "best effort" embed — the first provider in the list. */
export function getPrimaryEmbed(media: { id: number; type: 'movie' | 'tv' }, season?: number, episode?: number): string {
  const p = EMBED_PROVIDERS[0];
  return media.type === 'movie' ? p.movie(media.id) : p.tv(media.id, season ?? 1, episode ?? 1);
}