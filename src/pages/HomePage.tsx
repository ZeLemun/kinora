import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useTrending, usePopular, useTopRated, useUpcoming, useNowPlaying, useGenres } from '../hooks/useTMDB';
import { Hero, Rail, TopTenRail, type HeroItem, type RailItem } from '../components';
import { cn } from '../utils/cn';

function getGenreNames(genreIds: number[] | undefined, genres: { id: number; name: string }[]): string[] {
  if (!genreIds) return [];
  const map = new Map(genres.map((g) => [g.id, g.name]));
  return genreIds.map((id) => map.get(id)).filter(Boolean) as string[];
}

function mapItem(item: any, mediaType: 'movie' | 'series', genres: { id: number; name: string }[]): RailItem {
  return {
    id: String(item.id),
    name: mediaType === 'movie' ? item.title : item.name,
    poster: item.poster_path ?? undefined,
    backdrop: item.backdrop_path ?? undefined,
    releaseInfo: mediaType === 'movie' ? item.release_date : item.first_air_date,
    rating: item.vote_average,
    type: mediaType,
    overview: item.overview,
    genres: getGenreNames(item.genre_ids, genres),
  };
}

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [kind, setKind] = useState<'movies' | 'series'>('movies');

  const isMovies = kind === 'movies';
  const mediaType = isMovies ? 'movie' : 'series';

  const { data: movieGenres } = useGenres('movie');
  const { data: tvGenres } = useGenres('tv');
  const genres = isMovies ? movieGenres?.genres ?? [] : tvGenres?.genres ?? [];

  const trending = useTrending(isMovies ? 'movie' : 'tv', 'week');
  const popular = usePopular(isMovies ? 'movie' : 'tv');
  const topRated = useTopRated(isMovies ? 'movie' : 'tv');
  const upcoming = useUpcoming(isMovies ? 'movie' : 'tv');
  const nowPlaying = useNowPlaying();

  const trendingItems = (trending.data?.results ?? []).map((i) => mapItem(i, mediaType, genres));
  const popularItems = (popular.data?.results ?? []).map((i) => mapItem(i, mediaType, genres));
  const topRatedItems = (topRated.data?.results ?? []).map((i) => mapItem(i, mediaType, genres));
  const nowPlayingItems = (nowPlaying.data?.results ?? []).map((i) => mapItem(i, 'movie', movieGenres?.genres ?? []));
  const upcomingItems = (upcoming.data?.results ?? []).map((i) => mapItem(i, mediaType, genres));

  const heroItems: HeroItem[] = trendingItems.slice(0, 5).map((i) => ({
    id: i.id,
    name: i.name,
    poster: i.poster,
    backdrop: i.backdrop,
    releaseInfo: i.releaseInfo,
    rating: i.rating,
    type: i.type,
    overview: i.overview,
    genres: i.genres,
  }));

  const kindToggle = (
    <div className="flex gap-1">
      {(['movies', 'series'] as const).map((k) => (
        <button
          key={k}
          onClick={() => setKind(k)}
          aria-pressed={kind === k}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
            kind === k ? 'bg-primary text-white' : 'bg-surface text-text-muted hover:text-text'
          )}
        >
          {k === 'movies' ? t('movies') : t('series')}
        </button>
      ))}
    </div>
  );

  return (
    <div className="pb-6">
      <Hero items={heroItems} isLoading={trending.isLoading} />

      <div className="space-y-7 px-4 pt-5">
        <TopTenRail
          title={t('trending')}
          items={trendingItems}
          isLoading={trending.isLoading}
          headerAction={kindToggle}
        />

        <Rail
          title={t('popular')}
          items={popularItems}
          isLoading={popular.isLoading}
          onSeeMore={() => navigate(`/browse/${mediaType}/popular`)}
        />

        <Rail
          title={t('topRated')}
          items={topRatedItems}
          isLoading={topRated.isLoading}
          onSeeMore={() => navigate(`/browse/${mediaType}/topRated`)}
        />

        <Rail
          title={isMovies ? t('nowPlaying') : t('upcoming')}
          items={isMovies ? nowPlayingItems : upcomingItems}
          isLoading={isMovies ? nowPlaying.isLoading : upcoming.isLoading}
          onSeeMore={() => navigate(`/browse/${mediaType}/${isMovies ? 'nowPlaying' : 'upcoming'}`)}
        />
      </div>
    </div>
  );
}
