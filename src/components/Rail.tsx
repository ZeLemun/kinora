import { Link } from 'react-router-dom';
import { MetaCard, MetaCardSkeleton } from './MetaCard';
import { cn } from '../utils/cn';
import { Skeleton } from './ui/basic';
import { useTranslation } from '../hooks/useTranslation';

interface RailProps {
  title: string;
  items: Array<{
    id: string;
    name: string;
    poster?: string;
    posterShape?: 'regular' | 'landscape' | 'square';
    releaseInfo?: string;
    rating?: number;
    type: 'movie' | 'series';
    genres?: string[];
  }>;
  isLoading?: boolean;
  skeletonCount?: number;
  size?: 'small' | 'medium' | 'large';
  onSeeMore?: () => void;
  seeMoreLabel?: string;
  className?: string;
}

export function Rail({
  title,
  items,
  isLoading = false,
  skeletonCount = 8,
  size = 'medium',
  onSeeMore,
  seeMoreLabel = 'See more',
  className,
}: RailProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between px-4">
          <h2 className="text-xl font-semibold text-text">{title}</h2>
        </div>
        <div className="rail gap-4 px-4" role="list">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <MetaCardSkeleton key={i} size={size} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between px-4">
          <h2 className="text-xl font-semibold text-text">{title}</h2>
        </div>
        <div className="px-4 py-12 text-center text-text-muted">
          {t('noResults') || 'No results found'}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between px-4">
        <h2 className="text-xl font-semibold text-text">{title}</h2>
        {onSeeMore && (
          <button
            onClick={onSeeMore}
            className="text-sm text-text-muted hover:text-text transition-colors"
          >
            {seeMoreLabel}
          </button>
        )}
      </div>
      <div className="rail gap-4 px-4" role="list">
        {items.map((item, index) => (
          <MetaCard
            key={`${item.id}-${index}`}
            meta={item}
            size={size}
            showRating
            showYear
          />
        ))}
      </div>
    </div>
  );
}

interface TopTenRailProps {
  title: string;
  items: Array<{
    id: string;
    name: string;
    poster?: string;
    releaseInfo?: string;
    rating?: number;
    type: 'movie' | 'series';
  }>;
  isLoading?: boolean;
  className?: string;
}

export function TopTenRail({
  title,
  items,
  isLoading = false,
  className,
}: TopTenRailProps) {

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <h2 className="text-xl font-semibold text-text px-4">{title}</h2>
        <div className="space-y-2 px-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <h2 className="text-xl font-semibold text-text px-4">{title}</h2>
      <div className="space-y-2 px-4">
        {items.slice(0, 10).map((item, index) => (
          <Link
            key={`${item.id}-${index}`}
            to={`/${item.type}/${item.id}`}
            className="flex items-center gap-4 p-2 rounded-lg bg-surface-hover hover:bg-surface-hover/80 transition-colors group"
          >
            <div className="flex-shrink-0 w-10 h-10 font-bold text-xl text-text-muted bg-surface rounded-lg flex items-center justify-center">
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate text-text">{item.name}</h3>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                {item.releaseInfo && <span>{new Date(item.releaseInfo).getFullYear()}</span>}
                {item.rating && (
                  <span className="flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    {item.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}