import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useLibrary, useFavorites } from '../hooks/useStremio';
import { Rail } from '../components';
import { cn } from '../utils/cn';
import { useState } from 'react';

export function LibraryPage() {
  const { t } = useTranslation();
  const { continueWatching, library } = useLibrary();
  const { favorites: favIds } = useFavorites();
  const [activeTab, setActiveTab] = useState<'continue' | 'list' | 'favorites'>('continue');

  const continueItems = continueWatching.map(item => ({
    id: item.id,
    name: item.title,
    type: item.type as 'movie' | 'series',
    poster: undefined,
    releaseInfo: undefined,
    rating: undefined,
    progress: item.progress,
    duration: item.duration,
    season: item.season,
    episode: item.episode,
  }));

  const listItems = library
    .filter(item => !continueWatching.some(c => c.type === item.type && c.id === item.id))
    .map(item => ({
      id: item.id,
      name: item.title,
      type: item.type as 'movie' | 'series',
      poster: undefined,
      releaseInfo: undefined,
      rating: undefined,
    }));

  const favoriteItems = library
    .filter(item => favIds.includes(item.id))
    .map(item => ({
      id: item.id,
      name: item.title,
      type: item.type as 'movie' | 'series',
      poster: undefined,
      releaseInfo: undefined,
      rating: undefined,
    }));

  const renderProgress = (progress: number, duration: number) => {
    const percentage = duration > 0 ? (progress / duration) * 100 : 0;
    return (
      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden mt-1">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
        <div className="flex gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab('continue')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === 'continue'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {t('continueWatching') || 'Continue Watching'}
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === 'list'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {t('myList') || 'My List'}
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
              activeTab === 'favorites'
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            )}
          >
            {t('favorites') || 'Favorites'}
          </button>
        </div>

        {activeTab === 'continue' && (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-text">{t('continueWatching') || 'Continue Watching'}</h1>

            {continueItems.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <svg className="mx-auto h-16 w-16 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-lg">{t('noContinueWatching') || 'Nothing to continue watching yet'}</p>
                <p className="text-sm mt-1">Start watching something to see it here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {continueItems.map((item, index) => (
                  <Link
                    key={`${item.id}-${index}`}
                    to={`/watch/${item.type}/${item.id}${item.season ? `/${item.season}/${item.episode}` : ''}`}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors group"
                  >
                    <div className="flex-shrink-0 w-24 h-36 relative overflow-hidden rounded-lg bg-surface-hover">
                      <div className="absolute inset-0 flex items-center justify-center text-text-muted">
                        <span className="text-2xl font-medium">{item.name.charAt(0)}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-text truncate">{item.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-text-muted mt-1">
                        {item.type === 'series' && item.season && item.episode && (
                          <span>S{item.season} E{item.episode}</span>
                        )}
                      </div>
                      {renderProgress(item.progress, item.duration)}
                      <p className="text-xs text-text-muted mt-1">
                        {Math.round((item.progress / item.duration) * 100)}% watched
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-text">{t('myList') || 'My List'}</h1>

            {listItems.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <svg className="mx-auto h-16 w-16 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <p className="text-lg">{t('myListEmpty') || 'Your list is empty'}</p>
                <p className="text-sm mt-1">Add movies and shows to your list</p>
              </div>
            ) : (
              <Rail
                title={t('myList') || 'My List'}
                items={listItems}
              />
            )}
          </div>
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-text">{t('favorites') || 'Favorites'}</h1>

            {favoriteItems.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <svg className="mx-auto h-16 w-16 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <p className="text-lg">{t('noFavorites') || 'No favorites yet'}</p>
                <p className="text-sm mt-1">Tap the heart icon on any movie or show to add it here</p>
              </div>
            ) : (
              <Rail
                title={t('favorites') || 'Favorites'}
                items={favoriteItems}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}