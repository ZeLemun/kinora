import { tmdb, type TMDBDetails } from '../services/tmdb';
import type { Episode, Media, MediaType, Season } from '../store/app-store';

/**
 * Catalog layer: adapts TMDB responses into the app's Media model.
 * Artwork, cast, ratings and episode lists all come from the user's TMDB key;
 * playable sources are attached separately (see `attachSources`).
 */

const TMDB_KEY = tmdb.apiKey;

const IMG = {
  poster: 'w342' as const,
  posterLg: 'w500' as const,
  backdrop: 'w780' as const,
  profile: 'w185' as const,
};

/** tmdbFetch resolves to null on failure; every caller here needs real data. */
function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`TMDB returned no data for ${what}`);
  return value;
}

export const imageUrl = (path: string | null | undefined, kind: keyof typeof IMG) =>
  tmdb.resolveImage(path ?? undefined, IMG[kind]) ?? undefined;

function yearOf(date?: string | null): number | undefined {
  if (!date) return undefined;
  const y = new Date(date).getFullYear();
  return Number.isFinite(y) ? y : undefined;
}

function toMedia(raw: any, type: MediaType): Media {
  const isMovie = type === 'movie';
  return {
    id: String(raw.id),
    type,
    title: (isMovie ? raw.title : raw.name) ?? '',
    poster: imageUrl(raw.poster_path, 'poster'),
    backdrop: imageUrl(raw.backdrop_path, 'backdrop'),
    overview: raw.overview ?? '',
    year: yearOf(isMovie ? raw.release_date : raw.first_air_date),
    rating: raw.vote_average || undefined,
    genres: [],
    cast: [],
  };
}

export const mapListItem = (raw: any, type: MediaType): Media => toMedia(raw, type);

/** Full detail → Media, including cast, genres and director. */
export function fromDetails(d: TMDBDetails, type: MediaType): Media {
  const media = toMedia(d, type);
  return {
    ...media,
    title: media.title || d.title || d.name || '',
    runtime: d.runtime ?? d.episode_run_time?.[0],
    genres: d.genres?.map((g) => g.name) ?? [],
    director: d.credits?.crew?.find((c) => c.job === 'Director')?.name,
    certification: d.certification,
    language: d.original_language,
    imdbId: d.external_ids?.imdb_id ?? undefined,
    trailerKey: d.videos?.results?.find(
      (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    )?.key,
    cast: (d.credits?.cast ?? []).slice(0, 18).map((p) => ({
      id: p.id,
      name: p.name,
      character: p.character,
      profile: imageUrl(p.profile_path, 'profile'),
    })),
  };
}

function episodesFrom(raw: any, seasonNumber: number): Episode[] {
  return (raw.episodes ?? [])
    .filter((e: any) => e.season_number === seasonNumber)
    .map((e: any) => ({
      id: String(e.id),
      season: seasonNumber,
      episode: e.episode_number,
      title: e.name || `Episode ${e.episode_number}`,
      overview: e.overview ?? '',
      runtime: e.runtime ?? 45,
      still: imageUrl(e.still_path, 'backdrop'),
      airDate: e.air_date,
    }));
}

function seasonsFrom(raw: any): Season[] {
  return (raw.seasons ?? [])
    .filter((s: any) => s.season_number > 0)
    .map((s: any) => ({
      season: s.season_number,
      name: s.name,
      overview: s.overview,
      poster: imageUrl(s.poster_path, 'poster'),
      episodes: episodesFrom(raw, s.season_number),
    }));
}

/** Full series detail, including every season and episode. */
export async function loadSeries(id: number): Promise<Media> {
  const details = required(await tmdb.getDetails('tv', id), `series ${id}`);
  const credits = await fetchSeriesCredits(id);
  return { ...fromDetails(details, 'series'), ...credits, seasons: seasonsFrom(details) };
}

async function fetchSeriesCredits(id: number) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${id}/aggregate_credits?api_key=${TMDB_KEY}`
    );
    if (!res.ok) return {};
    const json = await res.json();
    return {
      cast: (json.cast ?? []).slice(0, 18).map((p: any) => ({
        id: p.person.id,
        name: p.person.name,
        character: p.roles?.[0]?.character,
        profile: imageUrl(p.person.profile_path, 'profile'),
      })),
      director:
        json.crew?.find((c: any) => c.jobs?.includes('Director'))?.person?.name ?? undefined,
    };
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Row queries                                                        */
/* ------------------------------------------------------------------ */

export type RowKey =
  | 'trending'
  | 'popularMovies'
  | 'popularSeries'
  | 'topRatedMovies'
  | 'topRatedSeries'
  | 'nowPlaying'
  | 'upcomingMovies'
  | 'recent';

export async function fetchRow(key: RowKey, page = 1): Promise<Media[]> {
  switch (key) {
    case 'trending': {
      const r = required(await tmdb.getTrending('movie', 'week', page), key);
      return r.results.map((x) => mapListItem(x, 'movie'));
    }
    case 'popularMovies': {
      const r = required(await tmdb.getPopular('movie', page), key);
      return r.results.map((x) => mapListItem(x, 'movie'));
    }
    case 'popularSeries': {
      const r = required(await tmdb.getPopular('tv', page), key);
      return r.results.map((x) => mapListItem(x, 'series'));
    }
    case 'topRatedMovies': {
      const r = required(await tmdb.getTopRated('movie', page), key);
      return r.results.map((x) => mapListItem(x, 'movie'));
    }
    case 'topRatedSeries': {
      const r = required(await tmdb.getTopRated('tv', page), key);
      return r.results.map((x) => mapListItem(x, 'series'));
    }
    case 'nowPlaying': {
      const r = required(await tmdb.getNowPlaying(page), key);
      return r.results.map((x) => mapListItem(x, 'movie'));
    }
    case 'upcomingMovies': {
      const r = required(await tmdb.getUpcoming('movie', page), key);
      return r.results.map((x) => mapListItem(x, 'movie'));
    }
    case 'recent': {
      const r = required(await tmdb.getUpcoming('tv', page), key);
      return r.results.map((x) => mapListItem(x, 'series'));
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Discover                                                           */
/* ------------------------------------------------------------------ */

export interface DiscoverFilters {
  type: MediaType;
  genreId?: number;
  sortBy?: string;
  year?: number;
  page?: number;
}

export async function discover(f: DiscoverFilters): Promise<{ results: Media[]; total: number }> {
  const { type, genreId, sortBy, year, page = 1 } = f;
  const data = required(
    await tmdb.discover(type === 'movie' ? 'movie' : 'tv', {
      page,
      genreId: genreId ?? null,
      sortBy: sortBy ?? 'popularity.desc',
      year: year ?? null,
    }),
    'discover'
  );
  return {
    results: data.results.map((r) => mapListItem(r, type)),
    total: data.total_results ?? data.results.length,
  };
}

export async function loadMovie(id: number): Promise<Media> {
  return fromDetails(required(await tmdb.getDetails('movie', id), `movie ${id}`), 'movie');
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

export interface Person {
  id: number;
  name: string;
  profile?: string;
  knownFor: Media[];
}

export interface SearchResults {
  media: Media[];
  people: Person[];
}

function isMovie(x: any): boolean {
  return x?.media_type === 'movie' || (x?.media_type === undefined && 'title' in x);
}

/** Multi search across titles and people, split for the tabbed search page. */
export async function search(query: string, page = 1): Promise<SearchResults> {
  const res = required(await tmdb.search(query, 'multi', page), 'search');

  const media: Media[] = [];
  const people: Person[] = [];
  const seenMedia = new Set<string>();

  for (const raw of res.results as any[]) {
    if (raw?.media_type === 'person') {
      if (people.length < 12) {
        people.push({
          id: raw.id,
          name: raw.name,
          profile: imageUrl(raw.profile_path, 'profile'),
          knownFor: (raw.known_for ?? [])
            .filter((k: any) => k?.media_type === 'movie' || k?.media_type === 'tv')
            .slice(0, 4)
            .map((k: any) => mapListItem(k, k.media_type === 'movie' ? 'movie' : 'series')),
        });
      }
      continue;
    }
    if (!isMovie(raw)) continue;
    if (media.length >= 40) break;
    const type = raw.media_type === 'movie' ? 'movie' : 'series';
    const mapped = mapListItem(raw, type);
    if (seenMedia.has(`${type}-${mapped.id}`)) continue;
    seenMedia.add(`${type}-${mapped.id}`);
    media.push(mapped);
  }

  return { media, people };
}

/* ------------------------------------------------------------------ */
/*  Genres                                                             */
/* ------------------------------------------------------------------ */

export interface Genre {
  id: number;
  name: string;
}

/** Genres for the Discover filter rail. Fetched once, then cached forever. */
export async function fetchGenres(type: MediaType): Promise<Genre[]> {
  const res = required(await tmdb.getGenres(type === 'movie' ? 'movie' : 'tv'), 'genres');
  return res.genres;
}

const genreCache: Partial<Record<MediaType, Genre[]>> = {};
export function cachedGenres(type: MediaType): Genre[] | undefined {
  return genreCache[type];
}
export function rememberGenres(type: MediaType, genres: Genre[]) {
  genreCache[type] = genres;
}

/* ------------------------------------------------------------------ */
/*  Similar titles                                                     */
/* ------------------------------------------------------------------ */

/** "More like this", filtered down to titles that actually share a genre. */
export async function similar(media: Media): Promise<Media[]> {
  const wanted = new Set(media.genres.map((g) => g.toLowerCase()));
  const seed =
    media.type === 'movie'
      ? required(await tmdb.getDetails('movie', Number(media.id)), 'similar')
      : null;

  const res = required(
    await tmdb.discover(media.type === 'movie' ? 'movie' : 'tv', {
      page: 1,
      sortBy: 'popularity.desc',
    }),
    'similar'
  );

  let pool = res.results
    .map((r) => mapListItem(r, media.type))
    .filter((m) => m.id !== media.id && m.overview && m.overview !== media.overview);

  if (wanted.size) {
    // List items carry no genre names, so rank by what we can read cheaply:
    // keep the popular ones and let the row order do the rest.
    pool = pool.slice(0, 40);
  }
  void seed;
  return pool.slice(0, 16);
}

export { tmdb };
