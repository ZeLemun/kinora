import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../hooks/usePlayer';
import { useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

/**
 * Persistent mini player.
 *
 * Appears when something is loaded into the player and the user navigated away.
 * It is a link, not a live <video>: the real element unmounts with the player
 * page, so this shows what is loaded and how far in it was, and tapping it
 * returns to the player to resume.
 */
export function MiniPlayer({ lastPosition }: { lastPosition?: { time: number; duration: number } }) {
  const { target, stop } = usePlayer();
  const navigate = useNavigate();
  const location = useLocation();

  // Never show it over the player itself.
  if (!target || location.pathname.startsWith('/player/')) return null;

  const pct =
    lastPosition && lastPosition.duration > 0
      ? Math.min(100, (lastPosition.time / lastPosition.duration) * 100)
      : 0;

  const resumeTo = () => {
    const q = new URLSearchParams();
    if (target.season != null) q.set('season', String(target.season));
    if (target.episode != null) q.set('episode', String(target.episode));
    const suffix = q.toString() ? `?${q}` : '';
    navigate(`/player/${target.media.id}${suffix}`);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[68px] z-40 px-3 lg:bottom-4 lg:left-[266px] lg:px-6">
      <div className="pointer-events-auto mx-auto max-w-2xl">
        <div
          className={cn(
            'card flex items-center gap-3 overflow-hidden p-2 shadow-2xl backdrop-blur-xl',
            'fade-up'
          )}
        >
          {target.poster ? (
            <img
              src={target.poster}
              alt=""
              className="h-12 w-20 flex-none rounded-lg object-cover"
            />
          ) : (
            <span className="h-12 w-20 flex-none rounded-lg bg-elevated" />
          )}

          <button onClick={resumeTo} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold text-text">{target.media.title}</p>
            {target.episodeTitle ? (
              <p className="truncate text-[11px] text-text-muted">
                S{target.season} · E{target.episode} · {target.episodeTitle}
              </p>
            ) : (
              <p className="truncate text-[11px] text-text-muted">
                {target.source.kind === 'embed' ? 'Trailer' : target.source.quality ?? 'Ready to play'}
              </p>
            )}
          </button>

          <button
            onClick={resumeTo}
            aria-label="Return to player"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-elevated text-text transition-colors hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          <button
            onClick={stop}
            aria-label="Close mini player"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-text-muted transition-colors hover:bg-elevated hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>

          {pct > 0 ? (
            <span className="absolute inset-x-0 bottom-0 h-[2px] bg-transparent">
              <span
                className="block h-full bg-[var(--color-accent)]"
                style={{ width: `${pct}%` }}
              />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
