import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore, type Media } from '../store/app-store';
import { mediaHref } from './MediaCard';
import { Skeleton, useToast } from './ui';
import { cn } from '../utils/cn';

const fmtRuntime = (min?: number) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '');

/** Cinematic hero. Crossfades between featured titles with a slow Ken Burns push. */
export function Hero({ items, isLoading }: { items: Media[]; isLoading?: boolean }) {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const toggleWatchlist = useAppStore((s) => s.toggleWatchlist);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isListed = useAppStore((s) => (items[index] ? s.watchlist.includes(items[index].id) : false));
  const isFav = useAppStore((s) => (items[index] ? s.favorites.includes(items[index].id) : false));

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (isLoading || items.length === 0) {
    return (
      <div className="relative h-[68dvh] w-full overflow-hidden bg-card sm:h-[70dvh] lg:h-[620px]">
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
    );
  }

  // Clamped so a shrinking `items` list can never index past the end.
  const active = Math.min(index, items.length - 1);
  const item = items[active];

  return (
    <section className="relative h-[68dvh] w-full overflow-hidden bg-card sm:h-[70dvh] lg:h-[620px]">
      {items.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== active}
          className={cn(
            'absolute inset-0 transition-opacity duration-1000 ease-out',
            i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
        >
          {slide.backdrop ? (
            <img
              src={slide.backdrop}
              alt=""
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
              className={cn('h-full w-full object-cover object-top', i === active && 'kenburns')}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-elevated to-card" />
          )}
        </div>
      ))}

      {/* Transparent at the top, near-solid at the bottom, so the art reads. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-background" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/40 to-transparent" />

      <div key={item.id} className="absolute inset-0 flex items-end">
        <div className="fade-up w-full p-4 pb-10 sm:p-8 lg:max-w-2xl lg:p-12">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-white/75 sm:text-sm">
            {item.rating ? (
              <span className="flex items-center gap-1 font-semibold text-yellow-400">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {item.rating.toFixed(1)}
              </span>
            ) : null}
            {item.year && <span>{item.year}</span>}
            {fmtRuntime(item.runtime) && <span>{fmtRuntime(item.runtime)}</span>}
            {item.genres.slice(0, 2).map((g) => (
              <span key={g}>{g}</span>
            ))}
          </div>

          <h1 className="text-hero-shadow mt-2 line-clamp-2 text-3xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
            {item.title}
          </h1>

          {item.overview && (
            <p className="text-hero-shadow-sm mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80 sm:line-clamp-3 sm:text-base">
              {item.overview}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link to={`/player/${item.id}`}>
              <button className="btn btn-primary h-11 gap-2 px-6 text-sm sm:text-base">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
                Watch Now
              </button>
            </Link>

            <button
              onClick={() => {
                const r = toggleWatchlist(item.id);
                toast(r === 'added' ? 'Added to Watchlist' : 'Removed from Watchlist', r === 'added' ? 'success' : 'default');
              }}
              className="btn btn-secondary h-11 gap-2 px-5 text-sm"
              aria-pressed={isListed}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={isListed ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {isListed ? 'Saved' : 'Add to List'}
            </button>

            <button
              onClick={() => {
                const r = toggleFavorite(item.id);
                toast(r === 'added' ? 'Added to Favorites' : 'Removed from Favorites', r === 'added' ? 'success' : 'default');
              }}
              className="btn btn-secondary h-11 w-11 px-0"
              aria-label={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-pressed={isFav}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill={isFav ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            <Link to={mediaHref(item)}>
              <button className="btn btn-ghost h-11 gap-2 px-4 text-sm text-white/85 hover:bg-white/10">
                More Info
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Vertically centred on the right edge: the bottom of the hero is covered
          by the first content row, which is pulled up underneath it. */}
      {items.length > 1 ? (
        <div className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-1.5 sm:flex lg:right-8">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${it.title}`}
              aria-current={i === active ? 'true' : undefined}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === active ? 'w-1.5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
