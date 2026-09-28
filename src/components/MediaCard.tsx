import { memo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore, useIsFavorite, useIsInWatchlist, useProgressFor, type Media, selectToggleFavorite, selectToggleWatchlist } from '../store/app-store';
import { cn } from '../utils/cn';
import { ContextMenu, type MenuItem } from './ui';
import { useToast } from './ui';

export const mediaHref = (m: Pick<Media, 'type' | 'id'>) =>
  m.type === 'movie' ? `/movie/${m.id}` : `/series/${m.id}`;

const fmtRuntime = (min?: number) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '');

function Poster({ media, className }: { media: Media; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!media.poster || broken) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-elevated to-card',
          className
        )}
      >
        <span className="px-2 text-center text-2xl font-bold text-text-muted">
          {media.title.charAt(0)}
        </span>
      </div>
    );
  }
  return (
    <img
      src={media.poster}
      alt={media.title}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Poster card                                                        */
/* ------------------------------------------------------------------ */

export const PosterCard = memo(function PosterCard({ media }: { media: Media }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isFav = useIsFavorite(media.id);
  const isListed = useIsInWatchlist(media.id);
  const progress = useProgressFor(media.id);
  const toggleFavorite = useAppStore(selectToggleFavorite);
  const toggleWatchlist = useAppStore(selectToggleWatchlist);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const pct = progress && progress.duration > 0 ? progress.time / progress.duration : 0;
  const resumeAt =
    progress && pct > 0.01 && pct < 0.95
      ? `${Math.floor(progress.time / 60)}:${String(Math.floor(progress.time % 60)).padStart(2, '0')}`
      : null;

  const menu: MenuItem[] = [
    { label: 'Play', onSelect: () => navigate(`/player/${media.id}`) },
    ...(resumeAt
      ? [{ label: `Resume from ${resumeAt}`, onSelect: () => navigate(`/player/${media.id}`) }]
      : []),
    {
      label: isListed ? 'Remove from Watchlist' : 'Add to Watchlist',
      onSelect: () => {
        const r = toggleWatchlist(media.id);
        toast(r === 'added' ? 'Added to Watchlist' : 'Removed from Watchlist', r === 'added' ? 'success' : 'default');
      },
    },
    {
      label: isFav ? 'Remove from Favorites' : 'Add to Favorites',
      onSelect: () => {
        const r = toggleFavorite(media.id);
        toast(r === 'added' ? 'Added to Favorites' : 'Removed from Favorites', r === 'added' ? 'success' : 'default');
      },
    },
    { label: 'View Details', onSelect: () => navigate(mediaHref(media)), dividerBefore: true },
  ];

  return (
    <article className="rail-item group relative w-32 sm:w-36">
      <Link
        to={mediaHref(media)}
        className="card card-hover block focus-visible:outline-none"
        aria-label={media.title}
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-card">
          <Poster media={media} className="transition-transform duration-300 group-hover:scale-105" />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

          {/* Play affordance */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>

          {media.rating ? (
            <span className="badge badge-default absolute left-1.5 top-1.5 bg-black/70 text-white backdrop-blur-sm">
              {media.rating.toFixed(1)}
            </span>
          ) : null}

          {pct > 0.01 && pct < 0.95 ? (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
              <span
                className="block h-full bg-[var(--color-accent)]"
                style={{ width: `${pct * 100}%` }}
              />
            </span>
          ) : null}

          {media.type === 'series' ? (
            <span className="badge badge-default absolute bottom-1.5 left-1.5 bg-black/70 text-white backdrop-blur-sm">
              Series
            </span>
          ) : null}
        </div>

        <div className="px-2 py-2">
          <h3 className="truncate text-xs font-semibold text-text sm:text-sm">{media.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
            {media.year && <span>{media.year}</span>}
            {resumeAt && (
              <>
                {media.year && <span>·</span>}
                <span className="text-[var(--color-accent)]">{resumeAt}</span>
              </>
            )}
          </p>
        </div>
      </Link>

      {/* Hover actions */}
      <div className="pointer-events-none absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <IconToggle
          active={isFav}
          label={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
          onClick={() => {
            const r = toggleFavorite(media.id);
            toast(r === 'added' ? 'Added to Favorites' : 'Removed from Favorites', r === 'added' ? 'success' : 'default');
          }}
          path="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
        <IconToggle
          active={isListed}
          label={isListed ? 'Remove from Watchlist' : 'Add to Watchlist'}
          onClick={() => {
            const r = toggleWatchlist(media.id);
            toast(r === 'added' ? 'Added to Watchlist' : 'Removed from Watchlist', r === 'added' ? 'success' : 'default');
          }}
          path="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        />
        <span className="relative">
          <IconToggle
            active={menuOpen}
            label="More options"
            onClick={() => setMenuOpen((o) => !o)}
            path="M12 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 13.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM12 20.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
            fill
          />
          <ContextMenu
            open={menuOpen}
            anchorRef={menuRef}
            items={menu}
            onClose={() => setMenuOpen(false)}
          />
        </span>
      </div>
    </article>
  );
});

function IconToggle({
  active,
  label,
  onClick,
  path,
  fill = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  path: string;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
        active
          ? 'bg-[var(--color-accent)] text-white'
          : 'bg-black/65 text-white/85 hover:bg-black/85'
      )}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill={active || fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d={path} />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Landscape card — Continue Watching                                 */
/* ------------------------------------------------------------------ */

export const LandscapeCard = memo(function LandscapeCard({
  media,
  episodeLabel,
  remainingLabel,
  progress: progressPct,
}: {
  media: Media;
  episodeLabel?: string;
  remainingLabel?: string;
  progress?: number;
}) {
  const pct = Math.max(0, Math.min(1, progressPct ?? 0));
  return (
    <Link
      to={`/player/${media.id}`}
      className="card card-hover rail-item group block w-64 flex-none sm:w-72"
      aria-label={`Resume ${media.title}`}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-card">
        {media.backdrop ? (
          <img
            src={media.backdrop}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-elevated to-card" />
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="px-3 py-2.5">
        <h3 className="truncate text-sm font-semibold text-text">{media.title}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
          {episodeLabel && <span>{episodeLabel}</span>}
          {remainingLabel && (
            <>
              {episodeLabel && <span>·</span>}
              <span>{remainingLabel}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
});

/* ------------------------------------------------------------------ */
/*  Compact list item                                                  */
/* ------------------------------------------------------------------ */

export const ListItem = memo(function ListItem({
  media,
  right,
}: {
  media: Media;
  right?: React.ReactNode;
}) {
  return (
    <Link
      to={mediaHref(media)}
      className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-elevated"
    >
      <div className="relative h-16 w-11 flex-none overflow-hidden rounded-lg bg-card">
        <Poster media={media} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-text">{media.title}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
          {media.year && <span>{media.year}</span>}
          {media.rating && <span>★ {media.rating.toFixed(1)}</span>}
          {fmtRuntime(media.runtime) && <span>{fmtRuntime(media.runtime)}</span>}
          <span className="badge badge-default">{media.type === 'movie' ? 'Movie' : 'Series'}</span>
        </p>
      </div>
      {right}
    </Link>
  );
});

/* ------------------------------------------------------------------ */
/*  Grid                                                               */
/* ------------------------------------------------------------------ */

export function PosterGrid({ items }: { items: Media[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((m) => (
        <PosterCard key={m.id} media={m} />
      ))}
    </div>
  );
}
