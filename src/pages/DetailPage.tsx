import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useMeta, useStreams, useSubtitles } from '../hooks/useStremio';
import { useDetails, tmdb } from '../hooks/useTMDB';
import { formatRuntime, formatYear, formatRating } from '../utils/cn';
import { Button, Badge } from '../components/ui/basic';
import { cn } from '../utils/cn';
import { useState } from 'react';
import { useLibrary, useFavorites } from '../hooks/useStremio';

export function DetailPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const { t } = useTranslation();
  const { library, addToLibrary, removeFromLibrary } = useLibrary();
  const { favorites, toggleFavorite } = useFavorites();

  const isMovie = type === 'movie';
  const mediaType = isMovie ? 'movie' : 'series';
  const tmdbType = isMovie ? 'movie' : 'tv';

  const { data: metaData, isLoading: metaLoading, error: metaError } = useMeta(mediaType, id || '');
  const { data: tmdbData, isLoading: tmdbLoading } = useDetails(tmdbType, parseInt(id || '0'));
  const { data: streamsData, isLoading: _streamsLoading } = useStreams(mediaType, id || '');
  const { data: subtitlesData } = useSubtitles(mediaType, id || '');

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedStream, setSelectedStream] = useState(0);

  const meta = metaData?.meta;
  const tmdbDetails = tmdbData;
  const streams = streamsData?.streams || [];
  const subtitles = subtitlesData?.subtitles || [];

  const isInLibrary = library.some(item => item.type === mediaType && item.id === id);
  const isFavorite = favorites.includes(id || '');

  const handleWatch = (streamIndex: number) => {
    setSelectedStream(streamIndex);
    setShowPlayer(true);
  };

  const handleFavoriteToggle = () => {
    toggleFavorite(id || '');
  };

  const handleListToggle = () => {
    if (isInLibrary) {
      removeFromLibrary({ type: mediaType, id: id || '' });
    } else if (tmdbDetails) {
      addToLibrary({
        type: mediaType,
        id: id || '',
        title: tmdbDetails.title || tmdbDetails.name || '',
        duration: tmdbDetails.runtime || tmdbDetails.episode_run_time?.[0] || 0,
      });
    }
  };

  const seasons = tmdbDetails?.seasons?.filter(s => s.season_number > 0) || [];

  if (metaLoading && tmdbLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-48 mx-auto rounded animate-pulse bg-surface-hover" />
          <div className="h-4 w-64 mx-auto mt-4 rounded animate-pulse bg-surface-hover" />
        </div>
      </div>
    );
  }

  if (metaError || (!meta && !tmdbDetails)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-2">{t('error') || 'Error'}</h1>
          <p className="text-text-muted">{t('notFound') || 'Content not found'}</p>
        </div>
      </div>
    );
  }

  const title = meta?.name || tmdbDetails?.title || tmdbDetails?.name || id;
  const overview = meta?.description || tmdbDetails?.overview || t('noDescription');
  const poster = meta?.poster ? tmdb.getImageUrl(meta.poster, 'w500') : (tmdbDetails?.poster_path ? tmdb.getImageUrl(tmdbDetails.poster_path, 'w500') : null);
  const backdrop = meta?.background ? tmdb.getBackdropUrl(meta.background, 'w1280') : (tmdbDetails?.backdrop_path ? tmdb.getBackdropUrl(tmdbDetails.backdrop_path, 'w1280') : null);
  const releaseInfo = meta?.releaseInfo || tmdbDetails?.release_date || tmdbDetails?.first_air_date;
  const rating = meta?.rating || tmdbDetails?.vote_average;
  const genres = meta?.genres || tmdbDetails?.genres?.map((g: any) => g.name) || [];
  const runtime = tmdbDetails?.runtime || tmdbDetails?.episode_run_time?.[0];
  const cast = tmdbDetails?.credits?.cast?.slice(0, 10) || [];
  const videos = tmdbDetails?.videos?.results?.filter((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || [];

  return (
    <div className="min-h-screen bg-background">
      {backdrop && (
        <div className="absolute inset-0 -z-10">
          <img src={backdrop} alt="" className="w-full h-[60vh] object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pb-12 relative z-10">
        <div className="pt-32 pb-6">
          <div className="flex flex-col md:flex-row gap-6">
            {poster && (
              <img
                src={poster}
                alt={title}
                className="w-full md:w-72 aspect-[2/3] rounded-xl shadow-2xl object-cover flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0 pt-4 md:pt-0">
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.slice(0, 4).map((genre: string) => (
                  <Badge key={genre} variant="primary">{genre}</Badge>
                ))}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold text-text mb-2">{title}</h1>

              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-text-muted">
                {releaseInfo && <span>{formatYear(releaseInfo)}</span>}
                {releaseInfo && rating && <span>·</span>}
                {rating && (
                  <span className="flex items-center gap-1 text-yellow-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    {formatRating(rating)}
                  </span>
                )}
                {runtime && <span>{formatRuntime(runtime)}</span>}
                {!isMovie && <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm">{t('series') || 'Series'}</span>}
                {isMovie && <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-sm">{t('movie') || 'Movie'}</span>}
              </div>

              <p className="text-text-muted mb-6 max-w-2xl">{overview}</p>

              <div className="flex flex-wrap gap-3">
                {streams.length > 0 && (
                  <Button onClick={() => handleWatch(0)} size="lg" className="gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    {t('watchNow') || 'Watch Now'}
                  </Button>
                )}
                <Button variant="secondary" onClick={handleListToggle} size="lg" className="gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isInLibrary ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {isInLibrary ? t('removeFromList') : t('addToList')}
                </Button>
                <Button variant="ghost" onClick={handleFavoriteToggle} size="lg" className="gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!isMovie && seasons.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text mb-4">{t('seasons') || 'Seasons'}</h2>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season: any) => (
                <button
                  key={season.season_number}
                  onClick={() => {
                    setSelectedSeason(season.season_number);
                  }}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedSeason === season.season_number
                      ? 'bg-primary text-white'
                      : 'bg-surface text-text hover:bg-surface-hover border border-border'
                  )}
                >
                  {season.name || `Season ${season.season_number}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {streams.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text mb-4">{t('sources') || 'Available Sources'}</h2>
            <div className="space-y-2">
              {streams.map((stream, index) => (
                <button
                  key={index}
                  onClick={() => handleWatch(index)}
                  className={cn(
                    'w-full px-4 py-3 rounded-lg text-left transition-colors border',
                    selectedStream === index
                      ? 'bg-primary/10 border-primary text-text'
                      : 'bg-surface border-border hover:bg-surface-hover'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        stream.behaviorHints?.notWebReady ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                      )}>
                        {stream.title || `Source ${index + 1}`}
                      </span>
                      {stream.quality && (
                        <Badge variant="default">{stream.quality}</Badge>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {subtitles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text mb-4">{t('subtitles') || 'Subtitles'}</h2>
            <div className="flex flex-wrap gap-2">
              {subtitles.map((sub) => (
                <Badge key={sub.id} variant="default">{sub.lang}</Badge>
              ))}
            </div>
          </div>
        )}

        {cast.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text mb-4">{t('cast') || 'Cast'}</h2>
            <div className="rail gap-4 overflow-x-auto pb-4 -mb-4">
              {cast.map((person: any) => (
                <Link
                  key={person.id}
                  to={`/person/${person.id}`}
                  className="rail-item w-32 flex-shrink-0"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-hover mb-2">
                    {person.profile_path ? (
                      <img
                        src={tmdb.getProfileUrl(person.profile_path) || ''}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted font-medium">
                        {person.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="font-medium text-sm text-text truncate">{person.name}</p>
                  {person.character && (
                    <p className="text-xs text-text-muted truncate">{person.character}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-text mb-4">{t('trailers') || 'Trailers'}</h2>
            <div className="rail gap-4 overflow-x-auto pb-4 -mb-4">
              {videos.slice(0, 5).map((video: any) => (
                <a
                  key={video.key}
                  href={`https://www.youtube.com/watch?v=${video.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rail-item w-64 flex-shrink-0"
                >
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-900 mb-2">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-12 h-12 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-text truncate">{video.name}</p>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showPlayer && streams[selectedStream] && (
        <PlayerModal
          stream={streams[selectedStream]}
          subtitles={subtitles}
          title={title || 'Unknown'}
          onClose={() => setShowPlayer(false)}
        />
      )}
    </div>
  );
}

interface PlayerModalProps {
  stream: any;
  subtitles: any[];
  title: string;
  type: 'movie' | 'series';
  season: number;
  episode: number;
  onClose: () => void;
}

function PlayerModal({ stream, subtitles, title, onClose }: Omit<PlayerModalProps, 'type' | 'season' | 'episode'>) {
  const { t } = useTranslation();
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>('');

  const isHLS = stream.url?.includes('.m3u8');
  const isMP4 = stream.url?.includes('.mp4');

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      <div className="relative w-full h-full max-w-7xl max-h-[90vh] mx-4 my-8">
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full h-full relative">
          {isHLS && (
            <video
              controls
              autoPlay
              playsInline
              className="w-full h-full"
              src={stream.url}
            >
              {subtitles.map(sub => (
                <track
                  key={sub.id}
                  kind="subtitles"
                  src={sub.url}
                  srcLang={sub.lang}
                  label={sub.title || sub.lang}
                  default={sub.lang === 'en'}
                />
              ))}
            </video>
          )}
          {isMP4 && (
            <video
              controls
              autoPlay
              playsInline
              className="w-full h-full"
              src={stream.url}
            >
              {subtitles.map(sub => (
                <track
                  key={sub.id}
                  kind="subtitles"
                  src={sub.url}
                  srcLang={sub.lang}
                  label={sub.title || sub.lang}
                  default={sub.lang === 'en'}
                />
              ))}
            </video>
          )}
          {!isHLS && !isMP4 && (
            <div className="w-full h-full flex items-center justify-center">
              <iframe
                src={stream.url}
                className="w-full h-full"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <h3 className="text-white font-medium">{title}</h3>
          <div className="flex items-center gap-2">
            {subtitles.length > 0 && (
              <select
                value={selectedSubtitle}
                onChange={(e) => setSelectedSubtitle(e.target.value)}
                className="px-3 py-1 rounded bg-black/50 text-white text-sm"
              >
                <option value="">{t('subtitles') || 'Subtitles'} (Off)</option>
                {subtitles.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.title || sub.lang}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
