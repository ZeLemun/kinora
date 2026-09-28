const TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY ?? '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p';

/*
 * About hiding the key.
 *
 * It lives in `.env`, which is gitignored, and is inlined into the bundle at
 * build time by Vite — so it is not in the repository, but it *is* inside the
 * APK and anyone who unzips it can read it. That is unavoidable for a key the
 * client has to send itself, and it is the same trade every mobile API client
 * makes.
 *
 * What this does protect: the key is out of git history, out of diffs and out
 * of pull requests. What it does not: a determined reader of the APK. If the
 * key ever leaks, rotate it at the provider — the app reads it at build time,
 * so a rebuild picks up the replacement.
 *
 * (The v4 JWT is not used: those tokens carry an `nbf` of a few months' life
 * and this one expired in May 2026, which makes every v4 call a 404.)
 */

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  popularity: number;
  video: boolean;
}

export interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
  popularity: number;
  origin_country: string[];
}

export interface TMDBResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  vote_count: number;
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: TMDBSeason[];
  production_companies: { id: number; name: string; logo_path: string | null }[];
  certification?: string;
  credits?: TMDBCredits;
  videos?: TMDBVideos;
  external_ids?: { imdb_id: string | null };
  translations?: TMDBTranslations;
  original_language: string;
  status: string;
  tagline: string;
  homepage: string;
}

export interface TMDBSeason {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  vote_average: number;
}

export interface TMDBCredits {
  cast: TMDBPerson[];
  crew: TMDBPerson[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  job?: string;
  department?: string;
  order?: number;
}

export interface TMDBVideos {
  results: TMDBVideo[];
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TMDBTranslations {
  translations: TMDBTranslation[];
}

export interface TMDBTranslation {
  iso_639_1: string;
  iso_3166_1: string;
  name: string;
  english_name: string;
  data: { title: string; overview: string; homepage: string };
}

export interface TMDBGenre {
  id: number;
  name: string;
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'en-US');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB error ${response.status}:`, await response.text());
      return null;
    }
    return response.json();
  } catch (error) {
    console.error(`TMDB fetch error:`, error);
    return null;
  }
}

export const tmdb = {
  /** v3 API key. Non-expiring, unlike the v4 JWT. */
  apiKey: TMDB_KEY,

  async getTrending(type: 'movie' | 'tv', timeWindow: 'day' | 'week' = 'week', page = 1) {
    return tmdbFetch<TMDBResponse<TMDBMovie | TMDBTVShow>>(`/trending/${type}/${timeWindow}`, { page });
  },

  async getPopular(type: 'movie' | 'tv', page = 1) {
    return tmdbFetch<TMDBResponse<TMDBMovie | TMDBTVShow>>(`/discover/${type}`, {
      sort_by: 'popularity.desc',
      page,
    });
  },

  async getTopRated(type: 'movie' | 'tv', page = 1) {
    return tmdbFetch<TMDBResponse<TMDBMovie | TMDBTVShow>>(`/discover/${type}`, {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 100,
      page,
    });
  },

  async getUpcoming(type: 'movie' | 'tv', page = 1) {
    if (type === 'movie') {
      return tmdbFetch<TMDBResponse<TMDBMovie>>(`/movie/upcoming`, { page });
    }
    return tmdbFetch<TMDBResponse<TMDBTVShow>>(`/discover/tv`, {
      'first_air_date.gte': new Date().toISOString().split('T')[0],
      sort_by: 'first_air_date.asc',
      page,
    });
  },

  async getNowPlaying(page = 1) {
    return tmdbFetch<TMDBResponse<TMDBMovie>>(`/movie/now_playing`, { page });
  },

  async search(query: string, type: 'movie' | 'tv' | 'multi' = 'multi', page = 1) {
    return tmdbFetch<TMDBResponse<TMDBMovie | TMDBTVShow>>(`/search/${type}`, { query, page });
  },

  async getDetails(type: 'movie' | 'tv', id: number) {
    return tmdbFetch<TMDBDetails>(`/${type}/${id}`, {
      append_to_response: 'credits,videos,external_ids,translations',
    });
  },

  async getSeasonDetails(seriesId: number, seasonNumber: number) {
    return tmdbFetch<TMDBDetails>(`/tv/${seriesId}/season/${seasonNumber}`);
  },

  async getGenres(type: 'movie' | 'tv') {
    return tmdbFetch<{ genres: TMDBGenre[] }>(`/genre/${type}/list`);
  },

  /** Sortable/filterable catalog used by the "See all" browse page. */
  async discover(
    type: 'movie' | 'tv',
    options: { page?: number; genreId?: number | null; sortBy?: string; year?: number | null } = {}
  ) {
    const { page = 1, genreId = null, sortBy, year = null } = options;
    const params: Record<string, string | number> = { page };
    if (genreId) params.with_genres = genreId;
    if (year) {
      if (type === 'movie') {
        params['primary_release_date.gte'] = `${year}-01-01`;
        params['primary_release_date.lte'] = `${year}-12-31`;
      } else {
        params['first_air_date.gte'] = `${year}-01-01`;
        params['first_air_date.lte'] = `${year}-12-31`;
      }
    }
    if (sortBy) params.sort_by = sortBy;
    return tmdbFetch<TMDBResponse<TMDBMovie | TMDBTVShow>>(
      `/discover/${type}`,
      params
    );
  },

  async findByIMDb(imdbId: string) {
    return tmdbFetch<{ movie_results: TMDBMovie[]; tv_results: TMDBTVShow[] }>(`/find/${imdbId}`, {
      external_source: 'imdb_id',
    });
  },

  getImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') {
    if (!path) return null;
    return `${IMG_BASE}/${size}${path}`;
  },

  getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280') {
    if (!path) return null;
    return `${IMG_BASE}/${size}${path}`;
  },

  getProfileUrl(path: string | null, size: 'w45' | 'w185' | 'h632' | 'original' = 'w185') {
    if (!path) return null;
    return `${IMG_BASE}/${size}${path}`;
  },

  getLogoUrl(path: string | null, size: 'w45' | 'w92' | 'w154' | 'w185' | 'w300' | 'w500' | 'original' = 'w300') {
    if (!path) return null;
    return `${IMG_BASE}/${size}${path}`;
  },

  /**
   * Accepts either a TMDB relative path ("/abc.jpg") or an absolute URL
   * (Cinemeta / metahub) and returns something an <img> can load.
   */
  resolveImage(path: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w500') {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${IMG_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
  },
};