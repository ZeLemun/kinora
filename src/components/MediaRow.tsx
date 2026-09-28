import { useCallback, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PosterCard, LandscapeCard } from './MediaCard';
import { SkeletonRow } from './ui';
import type { Media } from '../store/app-store';

/** Horizontally scrollable section with optional See All + desktop arrows. */
export function MediaRow({
  title,
  items,
  isLoading,
  to,
  variant = 'poster',
  children,
  emptyLabel,
}: {
  title: string;
  items: Media[];
  isLoading?: boolean;
  to?: string;
  variant?: 'poster' | 'landscape';
  children?: (item: Media) => ReactNode;
  emptyLabel?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  }, []);

  const header = (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="truncate text-base font-semibold tracking-wide text-text sm:text-lg">
        {title}
      </h2>
      <div className="flex flex-none items-center gap-1">
        {/* Arrows are a desktop affordance; touch users just swipe. */}
        <button
          onClick={() => scrollBy(-1)}
          aria-label={`Scroll ${title} left`}
          className="hidden h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-elevated hover:text-text lg:flex"
        >
          <Chevron dir="left" />
        </button>
        <button
          onClick={() => scrollBy(1)}
          aria-label={`Scroll ${title} right`}
          className="hidden h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-elevated hover:text-text lg:flex"
        >
          <Chevron dir="right" />
        </button>
        {to && (
          <Link
            to={to}
            className="ml-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted transition-colors hover:text-[var(--color-accent)]"
          >
            See All
          </Link>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <section>
        {header}
        <SkeletonRow count={8} wide={variant === 'landscape'} />
      </section>
    );
  }

  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <section>
        {header}
        <div className="rounded-xl border border-line bg-card px-4 py-8 text-center text-sm text-text-muted">
          {emptyLabel}
        </div>
      </section>
    );
  }

  return (
    <section>
      {header}
      <div ref={scroller} className="rail rail-bleed fade-edges">
        {items.map((m) =>
          children ? (
            <div key={m.id} className="flex-none">
              {children(m)}
            </div>
          ) : variant === 'landscape' ? (
            <LandscapeCard key={m.id} media={m} />
          ) : (
            <PosterCard key={m.id} media={m} />
          )
        )}
      </div>
    </section>
  );
}

export function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
