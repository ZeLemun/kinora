import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../hooks/useTranslation';
import { tmdb } from '../services/tmdb';
import { MetaCard, EmptyState, type RailItem } from '../components';
import { cn } from '../utils/cn';

type CatalogKey = 'popular' | 'topRated' | 'trending' | 'nowPlaying' | 'upcoming' | 'discover';

const CATALOG_LABEL: Record<CatalogKey, 'popular' | 'topRated' | 'trending' | 'nowPlaying' | 'upcoming' | 'popular'> = {
  popular: 'popular',
  topRated: 'topRated',
  trending: 'trending',
  nowPlaying: 'nowPlaying',
  upcoming: 'upcoming',
  discover: 'popular',
};

const SORT_OPTIONS: { value: string; label: 'popularity.desc' | 'vote_average.desc' }[] = [
  { value: 'popularity.desc', label: 'popularity.desc' },
  { value: 'vote_average.desc', label: 'vote_average.desc' },
];

function toItem(raw: any, isMovie: boolean): RailItem {
  return {
    id: String(raw.id),
    name: (isMovie ? raw.title : raw.name) ?? '',
    poster: raw.poster_path ?? undefined,
    releaseInfo: (isMovie ? raw.release_date : raw.first_air_date) ?? undefined,
    rating: raw.vote_average,
    type: isMovie ? 'movie' : 'series',
  };
}

/** Full catalog grid behind every "See all" link on the home rows. */
export function BrowsePage() {
  const { type = 'movie', catalog = 'popular' } = useParams<{ type: string; catalog: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isMovie = type === 'movie';
  const tmdbType = isMovie ? 'movie' : 'tv';
  const key = (catalog in CATALOG_LABEL ? catalog : 'popular') as CatalogKey;
  const [page, setPage] = useState(1);
  const [genre, setGenre] = useState<number | null>(null);
  const [sort, setSort] = useState('popularity.desc');

  const { data: genreData } = useQuery({
    queryKey: ['tmdb', 'genres', tmdbType],
    queryFn: () => tmdb.getGenres(tmdbType),
    staleTime: 1000 * 60 * 60 * 24,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['browse', tmdbType, key, page, genre, sort],
    queryFn: () => {
      if (key === 'discover' || genre) {
        return tmdb.discover(tmdbType, { page, genreId: genre, sortBy: sort });
      }
      switch (key) {
        case 'topRated':
          return tmdb.getTopRated(tmdbType, page);
        case 'trending':
          return tmdb.getTrending(tmdbType, 'week');
        case 'nowPlaying':
          return isMovie ? tmdb.getNowPlaying(page) : tmdb.getUpcoming(tmdbType, page);
        case 'upcoming':
          return tmdb.getUpcoming(tmdbType, page);
        default:
          return tmdb.getPopular(tmdbType, page);
      }
    },
    staleTime: 1000 * 60 * 10,
  });

  const items = (data?.results ?? []).map((r) => toItem(r, isMovie));
  const totalPages = data?.total_pages ?? 1;
  const title = t(CATALOG_LABEL[key]);
  const genres = genreData?.genres ?? [];

  return (
    <div className="px-4 py-5">
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="-ml-1 rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text"
          aria-label="Indietro"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-text">{title}</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="flex-none rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-text"
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Genre filter rail */}
      <div className="rail rail-bleed -mt-1 mb-4">
        <button
          onClick={() => setGenre(null)}
          className={cn(
            'flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            genre === null ? 'bg-primary text-white' : 'bg-surface text-text-muted'
          )}
        >
          {t('genres')}
        </button>
        {genres.map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGenre(g.id);
              setPage(1);
            }}
            className={cn(
              'flex-none whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              genre === g.id ? 'bg-primary text-white' : 'bg-surface text-text-muted'
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t('noResults')} />
      ) : (
        <div className={cn('grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5', isFetching && 'opacity-60')}>
          {items.map((item, i) => (
            <MetaCard key={`${item.id}-${i}`} meta={item} size="medium" showRating={false} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-text-muted">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
