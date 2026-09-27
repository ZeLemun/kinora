import { Link } from 'react-router-dom';
import { tmdb } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils/cn';
import { Badge, Skeleton } from './ui/basic';
import { useState } from 'react';
import { useFavorites } from '../hooks/useStremio';

interface MetaCardProps {
  meta: {
    id: string;
    name: string;
    poster?: string;
    posterShape?: 'regular' | 'landscape' | 'square';
    releaseInfo?: string;
    rating?: number;
    type: 'movie' | 'series';
    genres?: string[];
  };
  size?: 'small' | 'medium' | 'large';
  showRating?: boolean;
  showYear?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  small: 'w-24 h-36 rail-item',
  medium: 'w-32 h-48 rail-item',
  large: 'w-40 h-60 rail-item',
};

const aspectRatios = {
  regular: 'aspect-[2/3]',
  landscape: 'aspect-[16/9]',
  square: 'aspect-square',
};

export function MetaCard({
  meta,
  size = 'medium',
  showRating = true,
  showYear = true,
  className,
  onClick,
}: MetaCardProps) {
  const { favorites, toggleFavorite } = useFavorites();
  const [imageError, setImageError] = useState(false);
  const isFavorite = favorites.includes(meta.id);

  const posterUrl = meta.poster
    ? tmdb.getImageUrl(meta.poster, size === 'large' ? 'w780' : 'w500')
    : null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.();
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(meta.id);
  };

  if (!posterUrl || imageError) {
    return (
      <Link
        to={`/${meta.type}/${meta.id}`}
        onClick={handleClick}
        className={cn(
          'relative flex flex-col group rail-item',
          sizeClasses[size],
          className
        )}
      >
        <div className={cn('relative overflow-hidden rounded-lg bg-surface-hover', aspectRatios[meta.posterShape || 'regular'])}>
          <div className="absolute inset-0 flex items-center justify-center text-text-muted">
            <span className="text-lg font-medium">{meta.name.charAt(0)}</span>
          </div>
        </div>
        <MetaCardInfo meta={meta} showRating={showRating} showYear={showYear} size={size} />
      </Link>
    );
  }

  return (
    <Link
      to={`/${meta.type}/${meta.id}`}
      onClick={handleClick}
      className={cn(
        'relative flex flex-col group rail-item',
        sizeClasses[size],
        className
      )}
    >
      <div className={cn('relative overflow-hidden rounded-lg bg-surface-hover', aspectRatios[meta.posterShape || 'regular'])}>
        <img
          src={posterUrl}
          alt={meta.name}
          loading="lazy"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleFavoriteClick}
            className="p-1.5 rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {showRating && meta.rating && (
          <Badge
            className="absolute bottom-2 left-2"
            variant={meta.rating >= 7 ? 'success' : meta.rating >= 5 ? 'warning' : 'danger'}
          >
            {formatRating(meta.rating)}
          </Badge>
        )}
      </div>
      <MetaCardInfo meta={meta} showRating={showRating} showYear={showYear} size={size} />
    </Link>
  );
}

function MetaCardInfo({
  meta,
  showRating,
  showYear,
  size,
}: Pick<MetaCardProps, 'meta' | 'showRating' | 'showYear' | 'size'>) {
  const textSizes: Record<'small' | 'medium' | 'large', string> = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  const sizeKey = (size || 'medium') as 'small' | 'medium' | 'large';

  return (
    <div className="mt-2 flex-1 min-w-0">
      <h3 className={cn('font-medium truncate', textSizes[sizeKey])}>{meta.name}</h3>
      <div className="flex items-center gap-1 mt-1 text-text-muted text-xs">
        {showYear && meta.releaseInfo && (
          <span>{formatYear(meta.releaseInfo)}</span>
        )}
        {showRating && meta.rating && (
          <>
            {meta.releaseInfo && <span>·</span>}
            <span className="flex items-center gap-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {formatRating(meta.rating)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function MetaCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <div className={cn('rail-item', sizeClasses[size])}>
      <Skeleton className={cn('rounded-lg', 'aspect-[2/3]')} />
      <Skeleton className="mt-2 h-4 w-3/4 rounded" />
      <Skeleton className="mt-1 h-3 w-1/2 rounded" />
    </div>
  );
}