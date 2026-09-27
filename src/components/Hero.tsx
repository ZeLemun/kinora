import { Link } from 'react-router-dom';
import { tmdb } from '../services/tmdb';
import { formatYear, formatRating } from '../utils/cn';
import { useState, useEffect } from 'react';
import { Button, Skeleton } from './ui/basic';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../utils/cn';

export interface HeroItem {
  id: string;
  name: string;
  poster?: string;
  /** TMDB backdrop_path (relative) or an absolute URL. */
  backdrop?: string;
  releaseInfo?: string;
  rating?: number;
  type: 'movie' | 'series';
  overview?: string;
  genres?: string[];
  runtime?: number;
}

interface HeroProps {
  items: HeroItem[];
  isLoading?: boolean;
  className?: string;
}

/** Portrait: tall banner. Landscape: short banner so rows below stay visible. */
const HERO_BOX =
  'relative h-[78vw] max-h-[460px] w-full overflow-hidden bg-surface-hover ' +
  '[@media(orientation:landscape)]:h-[34vh] [@media(orientation:landscape)]:max-h-[300px]';

export function Hero({ items, isLoading = false, className }: HeroProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (isLoading || items.length === 0) {
    return (
      <div className={cn(HERO_BOX, className)}>
        <Skeleton className="absolute inset-0 rounded-none" />
      </div>
    );
  }

  const active = Math.min(index, items.length - 1);
  const item = items[active];

  return (
    <div className={cn(HERO_BOX, className)}>
      {/* All slides are stacked and crossfade; the active one also slowly zooms. */}
      {items.map((slide, i) => {
        const src = broken[slide.id] ? null : tmdb.resolveImage(slide.backdrop, 'w1280');
        const isActive = i === active;
        return (
          <div
            key={slide.id}
            aria-hidden={!isActive}
            className={cn(
              'absolute inset-0 transition-opacity duration-[1000ms] ease-out',
              isActive ? 'opacity-100' : 'pointer-events-none opacity-0'
            )}
          >
            {src ? (
              <img
                src={src}
                alt=""
                onError={() => setBroken((b) => ({ ...b, [slide.id]: true }))}
                className={cn('h-full w-full object-cover object-top', isActive && 'kenburns')}
              />
            ) : (
              <div
                className={cn('h-full w-full scale-110 bg-cover bg-center blur-2xl', isActive && 'kenburns')}
                style={{
                  backgroundImage: tmdb.resolveImage(slide.poster, 'w500')
                    ? `url(${tmdb.resolveImage(slide.poster, 'w500')})`
                    : undefined,
                  opacity: 0.55,
                }}
              />
            )}
          </div>
        );
      })}

      {/* Transparent at the top so the fanart pops, solid at the bottom for text. */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/25 to-background" />

      {/* keyed on the slide so the copy fades in with the artwork */}
      <div key={item.id} className="absolute inset-x-0 bottom-0 animate-[fadeUp_700ms_ease-out] p-4 pb-6 sm:p-6">
        <div className="max-w-2xl">
          <Link to={`/${item.type}/${item.id}`}>
            <h1 className="text-hero-shadow line-clamp-2 text-3xl font-bold leading-tight text-white sm:text-5xl">
              {item.name}
            </h1>
          </Link>

          {/* Single metadata row: rating, year, genres. */}
          <div className="text-hero-shadow-sm mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-white/80 sm:text-sm">
            {item.rating ? (
              <span className="flex items-center gap-1 font-medium text-yellow-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {formatRating(item.rating)}
              </span>
            ) : null}
            {item.releaseInfo ? <span>{formatYear(item.releaseInfo)}</span> : null}
            {item.genres?.slice(0, 3).map((g) => (
              <span key={g}>{g}</span>
            ))}
          </div>

          {item.overview ? (
            <p className="text-hero-shadow-sm mt-2.5 line-clamp-2 text-xs leading-relaxed text-white/80 sm:line-clamp-3 sm:text-sm">
              {item.overview}
            </p>
          ) : null}

          {/* Uniform height, 10dp radius, equal width on mobile. */}
          <div className="mt-5 flex gap-2">
            <Link to={`/watch/${item.type}/${item.id}`} className="min-w-0 flex-1 sm:flex-none">
              <Button size="md" className="h-11 w-full gap-2 rounded-[10px] sm:w-auto sm:px-6">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {t('watchNow')}
              </Button>
            </Link>
            <Link to={`/${item.type}/${item.id}`} className="min-w-0 flex-1 sm:flex-none">
              <Button
                size="md"
                variant="secondary"
                className="h-11 w-full gap-2 rounded-[10px] border-white/20 bg-white/15 text-white hover:bg-white/25 sm:w-auto sm:px-6"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                </svg>
                {t('moreInfo')}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Pagination dots, bottom-right just above the CTA row. */}
      {items.length > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setIndex(i)}
              aria-label={it.name}
              aria-current={i === index}
              className={cn(
                'h-1 rounded-full transition-all duration-300',
                i === index ? 'w-4 bg-white' : 'w-1 bg-white/45'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
