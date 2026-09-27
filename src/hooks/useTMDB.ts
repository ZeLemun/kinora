import { useQuery } from '@tanstack/react-query';
import { tmdb, type TMDBMovie, type TMDBTVShow, type TMDBDetails, type TMDBGenre, type TMDBResponse } from '../services/tmdb';

export function useTrending(type: 'movie' | 'tv' = 'movie', timeWindow: 'day' | 'week' = 'week') {
  return useQuery({
    queryKey: ['tmdb', 'trending', type, timeWindow],
    queryFn: () => tmdb.getTrending(type, timeWindow),
    staleTime: 1000 * 60 * 30,
  });
}

export function usePopular(type: 'movie' | 'tv' = 'movie', page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'popular', type, page],
    queryFn: () => tmdb.getPopular(type, page),
    staleTime: 1000 * 60 * 30,
  });
}

export function useTopRated(type: 'movie' | 'tv' = 'movie', page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'topRated', type, page],
    queryFn: () => tmdb.getTopRated(type, page),
    staleTime: 1000 * 60 * 60,
  });
}

export function useUpcoming(type: 'movie' | 'tv' = 'movie', page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'upcoming', type, page],
    queryFn: () => tmdb.getUpcoming(type, page),
    staleTime: 1000 * 60 * 60,
  });
}

export function useNowPlaying(page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'nowPlaying', page],
    queryFn: () => tmdb.getNowPlaying(page),
    staleTime: 1000 * 60 * 60,
  });
}

export function useSearch(query: string, type: 'movie' | 'tv' | 'multi' = 'multi', page = 1) {
  return useQuery({
    queryKey: ['tmdb', 'search', query, type, page],
    queryFn: () => tmdb.search(query, type, page),
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 10,
  });
}

export function useDetails(type: 'movie' | 'tv', id: number) {
  return useQuery({
    queryKey: ['tmdb', 'details', type, id],
    queryFn: () => tmdb.getDetails(type, id),
    enabled: !!id,
    staleTime: 1000 * 60 * 60,
  });
}

export function useSeasonDetails(seriesId: number, seasonNumber: number) {
  return useQuery({
    queryKey: ['tmdb', 'season', seriesId, seasonNumber],
    queryFn: () => tmdb.getSeasonDetails(seriesId, seasonNumber),
    enabled: !!seriesId && !!seasonNumber,
    staleTime: 1000 * 60 * 60,
  });
}

export function useGenres(type: 'movie' | 'tv') {
  return useQuery({
    queryKey: ['tmdb', 'genres', type],
    queryFn: () => tmdb.getGenres(type),
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export function useFindByIMDb(imdbId: string) {
  return useQuery({
    queryKey: ['tmdb', 'find', imdbId],
    queryFn: () => tmdb.findByIMDb(imdbId),
    enabled: !!imdbId,
    staleTime: 1000 * 60 * 60 * 24,
  });
}

export { tmdb };
export type { TMDBMovie, TMDBTVShow, TMDBDetails, TMDBGenre, TMDBResponse };