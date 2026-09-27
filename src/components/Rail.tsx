import { Link } from 'react-router-dom';
import { useState } from 'react';
import { MetaCard, MetaCardSkeleton } from './MetaCard';
import { tmdb } from '../services/tmdb';
import { cn } from '../utils/cn';
import { Skeleton } from './ui/basic';
import { useTranslation } from '../hooks/useTranslation';

export interface RailItem {
  id: string;
  name: string;
  poster?: string;
  backdrop?: string;
  posterShape?: 'regular' | 'landscape' | 'square';
  releaseInfo?: string;
  rating?: number;
  type: 'movie' | 'series';
  genres?: string[];
  overview?: string;
}

interface RailProps {
  title: string;
  items: RailItem[];
  isLoading?: boolean;
  skeletonCount?: number;
  size?: 'small' | 'medium' | 'large';
  onSeeMore?: () => void;
  seeMoreLabel?: string;
  className?: string;
}

/** Stremio-style section header: title left, optional action(s) right. */
function SectionHeader({
  title,
  onSeeMore,
  seeMoreLabel,
  children,
}: {
  title: string;
  onSeeMore?: () => void;
  seeMoreLabel?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="truncate text-base font-semibold tracking-wide text-text sm:text-lg">{title}</h2>
      <div className="flex flex-none items-center gap-3">
        {children}
        {onSeeMore && (
          <button
            onClick={onSeeMore}
            className="text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-primary"
          >
            {seeMoreLabel ?? t('seeAll')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Section header + horizontal poster carousel with a "See all" action. */
export function Rail({
  title,
  items,
  isLoading = false,
  skeletonCount = 8,
  size = 'medium',
  onSeeMore,
  seeMoreLabel,
  className,
}: RailProps) {
  const header = (
    <SectionHeader title={title} onSeeMore={onSeeMore} seeMoreLabel={seeMoreLabel} />
  );

  if (isLoading) {
    return (
      <section className={className}>
        {header}
        <div className="rail rail-bleed" role="list">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <MetaCardSkeleton key={i} size={size} />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className={className}>
      {header}
      <div className="rail rail-bleed" role="list">
        {items.map((item, index) => (
          <MetaCard key={`${item.id}-${index}`} meta={item} size={size} />
        ))}
      </div>
    </section>
  );
}

interface TopTenRailProps {
  title: string;
  items: RailItem[];
  isLoading?: boolean;
  onSeeMore?: () => void;
  /** Rendered on the right of the header, e.g. the Movies/TV Shows toggle. */
  headerAction?: React.ReactNode;
  className?: string;
}

/** Poster grid columns: more columns as the viewport widens, capped tile width. */
const GRID = 'grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10';
/** Landscape is short: keep tiles small so several rows fit above the fold. */
const TILE = 'max-w-[150px] [@media(orientation:landscape)]:max-w-[112px]';

/**
 * Top 10 shown as a poster grid with a rank badge — never a plain text list.
 */
export function TopTenRail({
  title,
  items,
  isLoading = false,
  onSeeMore,
  headerAction,
  className,
}: TopTenRailProps) {
  if (isLoading) {
    return (
      <section className={className}>
        <SectionHeader title={title} onSeeMore={onSeeMore}>
          {headerAction}
        </SectionHeader>
        <div className={GRID}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] max-w-[150px] rounded-lg [@media(orientation:landscape)]:max-w-[112px]" />
          ))}
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className={className}>
      <SectionHeader title={title} onSeeMore={onSeeMore}>
        {headerAction}
      </SectionHeader>
      <div className={GRID}>
        {items.slice(0, 10).map((item, index) => (
          <TopTenTile key={`${item.id}-${index}`} item={item} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function TopTenTile({ item, rank }: { item: RailItem; rank: number }) {
  const [broken, setBroken] = useState(false);
  const posterUrl = broken ? null : tmdb.resolveImage(item.poster, 'w342');

  return (
    <Link to={`/${item.type}/${item.id}`} className={cn('group block', TILE)}>
      {/* Poster and title are separate blocks so the rank badge never overlaps text. */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface-hover">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.name}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-hover to-surface text-2xl font-semibold text-text-muted">
            {item.name.charAt(0)}
          </div>
        )}

        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-[11px] font-bold leading-[18px] text-white">
          {rank}
        </span>
      </div>

      <p className="mt-1.5 truncate whitespace-nowrap text-xs text-text-muted">{item.name}</p>
    </Link>
  );
}
