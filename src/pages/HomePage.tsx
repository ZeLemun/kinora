import { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useTrending, usePopular, useTopRated, useUpcoming, useNowPlaying, useGenres } from '../hooks/useTMDB';
import { Hero, Rail, TopTenRail } from '../components';
import { cn } from '../utils/cn';

interface RailItem {
  id: string;
  name: string;
  poster?: string;
  posterShape?: 'regular' | 'landscape' | 'square';
  releaseInfo?: string;
  rating?: number;
  type: 'movie' | 'series';
  overview?: string;
  genres?: string[];
}

function getGenreNames(genreIds: number[], genres: { id: number; name: string }[]): string[] {
  const genreMap = new Map(genres.map(g => [g.id, g.name]));
  return genreIds.slice(0, 3).map(id => genreMap.get(id)).filter(Boolean) as string[];
}

function mapToRailItem(item: any, mediaType: 'movie' | 'series', genreList: { id: number; name: string }[]): RailItem {
  return {
    id: item.id.toString(),
    name: mediaType === 'movie' ? item.title : item.name,
    poster: item.poster_path,
    releaseInfo: mediaType === 'movie' ? item.release_date : item.first_air_date,
    rating: item.vote_average,
    type: mediaType,
    overview: item.overview,
    genres: getGenreNames(item.genre_ids, genreList),
  };
}

export function HomePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'movies' | 'series'>('movies');

  const { data: movieGenres } = useGenres('movie');
  const { data: tvGenres } = useGenres('tv');

  const trendingMovies = useTrending('movie', 'week');
  const trendingSeries = useTrending('tv', 'week');
  const popularMovies = usePopular('movie');
  const popularSeries = usePopular('tv');
  const topRatedMovies = useTopRated('movie');
  const topRatedSeries = useTopRated('tv');
  const upcomingMovies = useUpcoming('movie');
  const upcomingSeries = useUpcoming('tv');
  const nowPlaying = useNowPlaying();

  const trending = activeTab === 'movies' ? trendingMovies : trendingSeries;
  const popular = activeTab === 'movies' ? popularMovies : popularSeries;
  const topRated = activeTab === 'movies' ? topRatedMovies : topRatedSeries;
  const upcoming = activeTab === 'movies' ? upcomingMovies : upcomingSeries;
  const genres = activeTab === 'movies' ? movieGenres : tvGenres;
  const mediaType = activeTab === 'movies' ? 'movie' : 'series';

  const heroItems: RailItem[] = trending.data?.results?.slice(0, 5).map(item => mapToRailItem(item, mediaType, genres?.genres || [])) || [];
  const trendingItems: RailItem[] = trending.data?.results?.slice(0, 20).map(item => mapToRailItem(item, mediaType, genres?.genres || [])) || [];
  const popularItems: RailItem[] = popular.data?.results?.slice(0, 20).map(item => mapToRailItem(item, mediaType, genres?.genres || [])) || [];
  const topRatedItems: RailItem[] = topRated.data?.results?.slice(0, 20).map(item => mapToRailItem(item, mediaType, genres?.genres || [])) || [];
  const upcomingItems: RailItem[] = upcoming.data?.results?.slice(0, 20).map(item => mapToRailItem(item, mediaType, genres?.genres || [])) || [];
  const nowPlayingItems: RailItem[] = nowPlaying.data?.results?.slice(0, 20).map(item => mapToRailItem(item, 'movie', movieGenres?.genres || [])) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <Hero
          items={heroItems}
          isLoading={trending.isLoading}
          className="mb-4"
        />

        <div className="flex gap-2 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab('movies')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === 'movies'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {t('movies')}
          </button>
          <button
            onClick={() => setActiveTab('series')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === 'series'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {t('series')}
          </button>
        </div>

        <TopTenRail
          title={t('trending')}
          items={trendingItems}
          isLoading={trending.isLoading}
        />

        <Rail
          title={t('popular')}
          items={popularItems}
          isLoading={popular.isLoading}
        />

        <Rail
          title={t('topRated')}
          items={topRatedItems}
          isLoading={topRated.isLoading}
        />

        <Rail
          title={activeTab === 'movies' ? t('nowPlaying') : t('upcoming')}
          items={activeTab === 'movies' ? nowPlayingItems : upcomingItems}
          isLoading={activeTab === 'movies' ? nowPlaying.isLoading : upcoming.isLoading}
        />
      </div>
    </div>
  );
}