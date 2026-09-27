import { Link } from 'react-router-dom';
import { tmdb } from '../services/tmdb';
import { formatYear, formatRating } from '../utils/cn';
import { useState, useEffect, useCallback } from 'react';
import { Button, Skeleton } from './ui/basic';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../utils/cn';

interface HeroProps {
  items: Array<{
    id: string;
    name: string;
    poster?: string;
    backdrop_path?: string;
    releaseInfo?: string;
    rating?: number;
    type: 'movie' | 'series';
    overview?: string;
    genres?: string[];
  }>;
  isLoading?: boolean;
  className?: string;
}

export function Hero({ items, isLoading = false, className }: HeroProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!autoPlay || items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoPlay, items.length]);

  const handleMouseEnter = useCallback(() => setAutoPlay(false), []);
  const handleMouseLeave = useCallback(() => setAutoPlay(true), []);

  if (isLoading || !currentItem) {
    return (
      <div className={cn('relative aspect-[16/9] rounded-xl overflow-hidden bg-surface-hover', className)}>
        <Skeleton className="absolute inset-0" />
      </div>
    );
  }

  const backdropUrl = currentItem.backdrop_path
    ? tmdb.getBackdropUrl(currentItem.backdrop_path, 'w1280')
    : null;

  return (
    <div
      className={cn('relative aspect-[16/9] rounded-xl overflow-hidden', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {backdropUrl && (
        <img
          src={backdropUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12">
        <div className="max-w-4xl">
          <div className="flex flex-wrap gap-2 mb-4">
            {currentItem.genres?.slice(0, 3).map((genre) => (
              <span key={genre} className="px-3 py-1 text-sm rounded-full bg-primary/20 text-primary border border-primary/30">
                {genre}
              </span>
            ))}
          </div>

          <Link to={`/${currentItem.type}/${currentItem.id}`} className="block group">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4 group-hover:text-primary transition-colors">
              {currentItem.name}
            </h1>
          </Link>

          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm text-gray-300">
            {currentItem.releaseInfo && <span>{formatYear(currentItem.releaseInfo)}</span>}
            {currentItem.releaseInfo && currentItem.rating && <span>·</span>}
            {currentItem.rating && (
              <span className="flex items-center gap-1 text-yellow-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {formatRating(currentItem.rating)}
              </span>
            )}
            {currentItem.type === 'series' && (
              <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm">
                {t('series') || 'Series'}
              </span>
            )}
            {currentItem.type === 'movie' && (
              <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm">
                {t('movie') || 'Movie'}
              </span>
            )}
          </div>

          <p className="text-gray-300 mb-6 max-w-2xl text-base md:text-lg line-clamp-3">
            {currentItem.overview || t('noDescription') || 'No description available'}
          </p>

          <div className="flex flex-wrap gap-4">
            <Link to={`/watch/${currentItem.type}/${currentItem.id}`}>
              <Button size="lg" className="gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t('watchNow') || 'Watch Now'}
              </Button>
            </Link>
            <Link to={`/${currentItem.type}/${currentItem.id}`}>
              <Button size="lg" variant="ghost" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                {t('moreInfo') || 'More Info'}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {items.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/40 hover:bg-white/60'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}