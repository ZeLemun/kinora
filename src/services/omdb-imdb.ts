import { useQuery } from '@tanstack/react-query';

const OMDB_KEY = 'c9a96900';
const OMDB_BASE = 'https://www.omdbapi.com';
const IMDB_BASE = 'https://imdb.iamidiotareyoutoo.com';

export interface OMDBMovie {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
}

export interface OMDBResponse {
  Search: OMDBMovie[];
  totalResults: string;
  Response: string;
}

export interface IMDBMovie {
  id: string;
  title: string;
  year: string;
  type: string;
  image: string;
  imdbRating: string;
  imdbID: string;
}

export interface IMDBResponse {
  results: IMDBMovie[];
}

async function omdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T | null> {
  const url = new URL(`${OMDB_BASE}${endpoint}`);
  url.searchParams.set('apikey', OMDB_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('OMDB fetch error:', error);
    return null;
  }
}

async function imdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${IMDB_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.error('IMDB fetch error:', error);
    return null;
  }
}

const omdbService = {
  async getByIMDbId(imdbId: string) {
    return omdbFetch<any>('', { i: imdbId, plot: 'full', r: 'json' });
  },

  async getByTitle(title: string, year?: string) {
    return omdbFetch<any>('', { t: title, y: year, plot: 'full', r: 'json' });
  },

  async search(query: string, type?: 'movie' | 'series' | 'episode', page = 1) {
    return omdbFetch<OMDBResponse>('', { s: query, type, page });
  },
};

const imdbService = {
  async search(query: string) {
    return imdbFetch<any>('/search', { q: query });
  },

  async getById(id: string) {
    return imdbFetch<any>(`/title/${id}`);
  },

  async getDetails(id: string) {
    return imdbFetch<any>(`/title/${id}/details`);
  },

  async getRatings(id: string) {
    return imdbFetch<any>(`/title/${id}/ratings`);
  },

  async getCredits(id: string) {
    return imdbFetch<any>(`/title/${id}/credits`);
  },

  async getImages(id: string) {
    return imdbFetch<any>(`/title/${id}/images`);
  },
};

export function useOMDBByIMDb(imdbId: string) {
  return useQuery({
    queryKey: ['omdb', 'byId', imdbId],
    queryFn: () => omdbService.getByIMDbId(imdbId),
    enabled: !!imdbId,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export function useOMDBSearch(query: string, type?: 'movie' | 'series' | 'episode', page = 1) {
  return useQuery({
    queryKey: ['omdb', 'search', query, type, page],
    queryFn: () => omdbService.search(query, type, page),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
  });
}

export function useIMDBSearch(query: string) {
  return useQuery({
    queryKey: ['imdb', 'search', query],
    queryFn: () => imdbService.search(query),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
  });
}

export function useIMDBDetails(id: string) {
  return useQuery({
    queryKey: ['imdb', 'details', id],
    queryFn: () => imdbService.getDetails(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export function useIMDBCredits(id: string) {
  return useQuery({
    queryKey: ['imdb', 'credits', id],
    queryFn: () => imdbService.getCredits(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export { omdbService as omdb, imdbService as imdb };