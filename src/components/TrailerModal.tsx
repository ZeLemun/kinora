import { useState } from 'react';
import type { TMDBVideo } from '../services/tmdb';

interface TrailerModalProps {
  videos: TMDBVideo[];
  onClose: () => void;
  onBack: () => void;
}

/**
 * In-app trailer playback.
 *
 * These come from the TMDB `/videos` endpoint, which returns YouTube ids rather
 * than media files — TMDB hosts no video content itself. Embedding the YouTube
 * player is the one form of "play something" that works without a debrid
 * account.
 */
export function TrailerModal({ videos, onClose, onBack }: TrailerModalProps) {
  const [index, setIndex] = useState(0);
  const video = videos[index];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex flex-none items-center gap-3 px-3 py-2">
        <button
          onClick={onBack}
          className="rounded-full p-2 text-white/90 hover:bg-white/10"
          aria-label="Back"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {video.name}
        </h3>
        {videos.length > 1 && (
          <span className="flex-none text-xs tabular-nums text-white/50">
            {index + 1} / {videos.length}
          </span>
        )}
        <button
          onClick={onClose}
          className="flex-none rounded-full p-2 text-white/90 hover:bg-white/10"
          aria-label="Close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
        <iframe
          key={video.key}
          src={`https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0&modestbranding=1`}
          title={video.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>

      {videos.length > 1 && (
        <div className="flex flex-none gap-2 overflow-x-auto scrollbar-hide border-t border-white/10 px-3 py-2">
          {videos.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setIndex(i)}
              className={
                i === index
                  ? 'flex-none rounded-full bg-primary px-3 py-1 text-xs font-medium text-white'
                  : 'flex-none rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/75'
              }
            >
              {v.type}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
