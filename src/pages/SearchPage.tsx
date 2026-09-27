import { useState } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { useSearch } from '../hooks/useTMDB';
import { useTranslation } from '../hooks/useTranslation';
import { Rail } from '../components';
import { Input } from '../components/ui/basic';
import { useSearchHistory } from '../hooks/useStremio';

export function SearchPage() {
  const { t } = useTranslation();
  const { searchHistory, addSearchHistory, clearSearchHistory } = useSearchHistory();
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading, error } = useSearch(debouncedQuery, 'multi', 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addSearchHistory(query.trim());
      setShowHistory(false);
    }
  };

  const handleHistoryClick = (item: string) => {
    setQuery(item);
    addSearchHistory(item);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setShowHistory(false);
  };

  if (!query && !showHistory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-2xl text-center">
          <svg className="mx-auto h-16 w-16 text-text-muted mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h1 className="text-2xl font-semibold text-text mb-2">{t('search') || 'Search'}</h1>
          <p className="text-text-muted">{t('searchPlaceholder') || 'Search movies & shows...'}</p>
        </div>
      </div>
    );
  }

  const movieResults = results?.results?.filter((r: any) => r.media_type === 'movie' || ('title' in r && !r.media_type)) || [];
  const tvResults = results?.results?.filter((r: any) => r.media_type === 'tv' || ('name' in r && !r.media_type)) || [];

  const mappedMovies = movieResults.map((item: any) => ({
    id: item.id.toString(),
    name: item.title || item.name,
    poster: item.poster_path,
    releaseInfo: item.release_date || item.first_air_date,
    rating: item.vote_average,
    type: (item.media_type === 'tv' || item.first_air_date ? 'series' : 'movie') as 'movie' | 'series',
  }));

  const mappedTV = tvResults.map((item: any) => ({
    id: item.id.toString(),
    name: item.name || item.title,
    poster: item.poster_path,
    releaseInfo: item.first_air_date || item.release_date,
    rating: item.vote_average,
    type: (item.media_type === 'movie' || item.release_date ? 'movie' : 'series') as 'movie' | 'series',
  }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="relative mb-6">
          <Input
            type="search"
            placeholder={t('searchPlaceholder') || 'Search movies & shows...'}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowHistory(true);
            }}
            onFocus={() => setShowHistory(true)}
            className="text-lg py-3 pl-12 pr-4"
            autoFocus
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>

        {showHistory && searchHistory.length > 0 && !query && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-text-muted">{t('history') || 'Recent Searches'}</h2>
              <button onClick={handleClearHistory} className="text-sm text-primary hover:underline">
                {t('clear') || 'Clear'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-surface border border-border text-text hover:bg-surface-hover transition-colors"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-text-muted">
            <p>{t('error') || 'Error'}: {error.message}</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-6">
            <Rail
              title={t('movies') || 'Movies'}
              items={[]}
              isLoading={true}
              size="medium"
            />
            <Rail
              title={t('series') || 'TV Shows'}
              items={[]}
              isLoading={true}
              size="medium"
            />
          </div>
        )}

        {!isLoading && !error && (
          <>
            {mappedMovies.length > 0 && (
              <Rail
                title={t('movies') || 'Movies'}
                items={mappedMovies}
              />
            )}
            {mappedTV.length > 0 && (
              <Rail
                title={t('series') || 'TV Shows'}
                items={mappedTV}
              />
            )}
            {mappedMovies.length === 0 && mappedTV.length === 0 && query && (
              <div className="text-center py-12 text-text-muted">
                <p>{t('noResults') || 'No results found'} for "{query}"</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}