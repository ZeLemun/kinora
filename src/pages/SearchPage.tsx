import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from '../hooks/useDebounce';
import { useSearch } from '../hooks/useTMDB';
import { useTranslation } from '../hooks/useTranslation';
import { MetaCard, EmptyState, type RailItem } from '../components';
import { Input } from '../components/ui/basic';
import { useSearchHistory } from '../hooks/useStremio';
import { cn } from '../utils/cn';

export function SearchPage() {
  const { t } = useTranslation();
  const { searchHistory, addSearchHistory, clearSearchHistory } = useSearchHistory();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const debouncedQuery = useDebounce(query, 350);

  const { data: results, isLoading, error } = useSearch(debouncedQuery, 'multi', 1);

  // Keep the URL in sync so the top-bar search can deep-link here.
  useEffect(() => {
    if (debouncedQuery) setParams({ q: debouncedQuery }, { replace: true });
  }, [debouncedQuery, setParams]);

  const commit = (value: string) => {
    const v = value.trim();
    if (v) addSearchHistory(v);
  };

  const items: RailItem[] = (results?.results ?? []).map((r) => {
    // `multi` search returns movies and shows mixed; discriminate on media_type.
    const withType = r as typeof r & { media_type?: 'movie' | 'tv' };
    const isTv = withType.media_type === 'tv';
    return {
      id: String(r.id),
      name: ('title' in r ? r.title : r.name) ?? '',
      poster: r.poster_path ?? undefined,
      releaseInfo: 'release_date' in r ? r.release_date : r.first_air_date,
      rating: r.vote_average,
      type: isTv ? 'series' : 'movie',
    };
  });

  return (
    <div className="px-4 py-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit(query);
        }}
        className="relative"
      >
        <Input
          type="search"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="py-2.5 pl-10 pr-10"
          autoFocus
        />
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            aria-label={t('close')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </form>

      {searchHistory.length > 0 && !query && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-muted">{t('history')}</h2>
            <button onClick={clearSearchHistory} className="text-sm text-primary hover:underline">
              {t('remove')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setQuery(item);
                  commit(item);
                }}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text transition-colors hover:bg-surface-hover"
              >
                {item}
              </button>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface-hover" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <EmptyState title={t('error')} message={error.message} />
      )}

      {!isLoading && !error && items.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {items.map((item, i) => (
            <MetaCard key={`${item.id}-${i}`} meta={item} size="medium" showRating={false} />
          ))}
        </div>
      )}

      {!isLoading && !error && query.length > 1 && items.length === 0 && (
        <EmptyState title={t('noResults')} message={`"${query}"`} />
      )}

      {!isLoading && !error && !query && searchHistory.length === 0 && (
        <div
          className={cn(
            'mt-16 flex flex-col items-center gap-3 text-center text-text-muted'
          )}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-sm">{t('searchPlaceholder')}</p>
        </div>
      )}
    </div>
  );
}
