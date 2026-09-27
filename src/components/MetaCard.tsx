import { Link } from 'react-router-dom';
import { useState } from 'react';
import { tmdb } from '../services/tmdb';
import { formatYear, formatRating, cn } from '../utils/cn';
import { Badge, Skeleton } from './ui/basic';
import { useFavorites } from '../hooks/useStremio';
import type { RailItem } from './Rail';

interface MetaCardProps {
  meta: RailItem;
  size?: 'small' | 'medium' | 'large';
  showRating?: boolean;
  showYear?: boolean;
  className?: string;
}

const sizeClasses: Record<'small' | 'medium' | 'large', string> = {
  small: 'w-24',
  medium: 'w-28 sm:w-32',
  large: 'w-40',
};

const textSizes: Record<'small' | 'medium' | 'large', string> = {
  small: 'text-[11px]',
  medium: 'text-xs sm:text-sm',
  large: 'text-base',
};

const aspectRatios: Record<string, string> = {
  regular: 'aspect-[2/3]',
  landscape: 'aspect-video',
  square: 'aspect-square',
};

/** 2:3 poster tile with initials fallback when artwork is missing. */
export function MetaCard({
  meta,
  size = 'medium',
  showRating = true,
  showYear = true,
  className,
}: MetaCardProps) {
  const { favorites, toggleFavorite } = useFavorites();
  const [broken, setBroken] = useState(false);
  const isFavorite = favorites.includes(meta.id);

  const posterUrl = broken ? null : tmdb.resolveImage(meta.poster, size === 'large' ? 'w780' : 'w500');
  const ratio = aspectRatios[meta.posterShape ?? 'regular'] ?? aspectRatios.regular;

  return (
    <Link to={`/${meta.type}/${meta.id}`} className={cn('rail-item group block flex-none', sizeClasses[size], className)}>
      <div className={cn('relative overflow-hidden rounded-lg bg-surface-hover', ratio)}>
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={meta.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-hover to-surface">
            <span className="text-2xl font-semibold text-text-muted">{meta.name.charAt(0)}</span>
          </div>
        )}

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(meta.id);
          }}
          className={cn(
            'absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm',
            isFavorite ? 'opacity-100' : 'opacity-0 transition-opacity group-hover:opacity-100'
          )}
          aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {showRating && meta.rating ? (
          <Badge
            className="absolute bottom-1.5 left-1.5"
            variant={meta.rating >= 7 ? 'success' : meta.rating >= 5 ? 'warning' : 'danger'}
          >
            {formatRating(meta.rating)}
          </Badge>
        ) : null}
      </div>

      <h3 className={cn('mt-2 truncate whitespace-nowrap font-medium text-text', textSizes[size])}>
        {meta.name}
      </h3>
      {(showYear || showRating) && (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
          {showYear && meta.releaseInfo ? <span>{formatYear(meta.releaseInfo)}</span> : null}
          {showYear && showRating && meta.rating && meta.releaseInfo ? <span>·</span> : null}
          {showRating && meta.rating ? <span>{formatRating(meta.rating)}</span> : null}
        </div>
      )}
    </Link>
  );
}

export function MetaCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  return (
    <div className={cn('rail-item flex-none', sizeClasses[size])}>
      <Skeleton className="aspect-[2/3] w-full rounded-lg" />
      <Skeleton className="mt-2 h-3 w-3/4 rounded" />
    </div>
  );
}
