import { useQuery } from '@tanstack/react-query';
import type { Media, MediaSource } from '../store/app-store';

/**
 * Playable source resolution.
 *
 * There is no add-on layer in this app. A `MediaSource` is a plain HTTPS URL
 * that a <video> element can play directly. Two things produce one:
 *
 *   - Internet Archive: public-domain and Creative Commons films, served as
 *     MP4 over plain HTTPS. Real, free, legal, and verified to accept range
 *     requests (HTTP 206), so seeking works.
 *   - A trailer: TMDB's /videos endpoint returns YouTube ids, which play in an
 *     embed. Not the film, but it is the real thing moving.
 *
 * Anything that needs an account (debrid services, P2P) is deliberately out of
 * scope: the WebView has no torrent engine and there is no free, no-account
 * source of first-run features.
 */

const IA_SEARCH = 'https://archive.org/advancedsearch.php';
const IA_METADATA = 'https://archive.org/metadata';
const IA_DOWNLOAD = 'https://archive.org/download';

/**
 * Collections that hold deliberately donated, clearly-licensed films.
 *
 * The archive's `mediatype:(movies)` index is overwhelmingly user uploads —
 * a search for "Metropolis" returns a tweet, and for "The General" a school
 * assembly recording. Restricting to these collections is what makes the
 * results actually be films.
 */
const FEATURE_COLLECTIONS = [
  'opensource_movies',
  'feature_films',
  'film_noir',
  'film_noir_2',
  'classic_cartoons',
  'film_silent',
];

/**
 * Nothing released this recently can be in the public domain, so anything
 * newer is skipped without a request.
 *
 * This is also the rule that keeps mislabeled upload dumps out. Searching a
 * 2026 film by title reliably returns items called exactly that, which bundle
 * several unrelated movies and are not what their name says.
 */
const PD_MAX_AGE_YEARS = 30;

interface ArchiveHit {
  identifier: string;
  title: string;
  year?: string;
  /** Set once the item's file list has been read and the item cleared. */
  usable?: boolean;
}

interface ArchiveFile {
  name?: string;
  format?: string;
  size?: string;
  length?: string;
}

/** Leading articles break the archive's exact-phrase title match. */
function stripArticle(title: string): string {
  return title.replace(/^(the|a|an|le|la|les|il|lo|i|gli|der|die|das|el|los|las)\s+/i, '').trim();
}

const NOISE = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'from']);

/**
 * How much of the requested title appears in a candidate.
 *
 * The archive's own search is far too loose — searching "Love Hypothesis"
 * happily returns "For The Love Of You Show 26". Anything below ~half the
 * meaningful words overlapping is a different film, so it is not a candidate.
 */
function overlap(requested: string, candidate: string): number {
  const want = new Set(
    stripArticle(requested)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !NOISE.has(w))
  );
  if (want.size === 0) return 1;

  const have = new Set(
    candidate
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
  );
  let hits = 0;
  for (const w of want) if (have.has(w)) hits++;
  return hits / want.size;
}

const collectionClause = FEATURE_COLLECTIONS.map((c) => `collection:${c}`).join(' OR ');

async function searchArchive(title: string, year?: number): Promise<ArchiveHit[]> {
  const clean = stripArticle(title);
  if (!clean) return [];

  // A recent release is not public domain. Skip the request entirely.
  if (year && year > new Date().getFullYear() - PD_MAX_AGE_YEARS) return [];

  const query =
    `title:("${clean}") AND mediatype:(movies) AND (${collectionClause})` +
    (year ? ` AND year:[${year - 3} TO ${year + 3}]` : '');

  const url =
    `${IA_SEARCH}?q=${encodeURIComponent(query)}` +
    '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=8&page=1&output=json';

  let docs: ArchiveHit[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    docs = ((await res.json())?.response?.docs ?? []) as ArchiveHit[];
  } catch {
    return [];
  }

  return docs.filter((d) => {
    if (!d.identifier) return false;
    if (overlap(clean, d.title ?? '') < 0.6) return false;
    if (year && d.year) {
      const gap = Math.abs(Number(d.year) - year);
      if (Number.isFinite(gap) && gap > 3) return false;
    }
    return true;
  });
}

function qualityOf(name: string): string {
  if (/2160|4k|uhd/i.test(name)) return '2160p';
  if (/1080/i.test(name)) return '1080p';
  if (/720/i.test(name)) return '720p';
  if (/360|480/i.test(name)) return '480p';
  return 'SD';
}

async function toSource(hit: ArchiveHit): Promise<MediaSource | null> {
  try {
    const res = await fetch(`${IA_METADATA}/${hit.identifier}`);
    if (!res.ok) return null;
    const json = await res.json();
    const files: ArchiveFile[] = json?.files ?? [];

    const mp4s = files.filter(
      (f) =>
        typeof f.name === 'string' &&
        /\.mp4$/i.test(f.name) &&
        (f.format === 'h.264' || /h\.?264/i.test(f.name)) &&
        Number(f.size ?? 0) > 20_000_000
    );
    if (!mp4s.length) return null;

    // Reject bulk dumps. An item holding several unrelated large movies under
    // one title is an upload dump, not a donated film, and its "main" file is
    // not reliably the thing its name says.
    if (mp4s.length > 2) return null;

    // A ~40-minute-plus file, so a trailer or clip is never passed off as the
    // feature. (10 MB/s is roughly 2.4 GB for 100 minutes.)
    const bySize = [...mp4s].sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
    const longest = bySize.find((f) => Number(f.length ?? 0) > 2400) ?? bySize[0];
    if (Number(longest.length ?? 0) > 0 && Number(longest.length ?? 0) < 1800) return null;

    // Skip absurd remasters so playback does not stall on a phone.
    const chosen = bySize.find((f) => Number(f.size ?? 0) < 2_500_000_000) ?? bySize[0];
    if (!chosen?.name) return null;

    const minutes = Math.round(Number(chosen.length ?? 0) / 60);
    return {
      url: `${IA_DOWNLOAD}/${hit.identifier}/${encodeURIComponent(chosen.name)}`,
      label: minutes > 0 ? `${hit.title} · ${minutes} min` : hit.title,
      quality: qualityOf(chosen.name),
      kind: 'free',
    };
  } catch {
    return null;
  }
}

/**
 * The official trailer, from TMDB's /videos endpoint. That returns a YouTube
 * *id*, not a media file — TMDB hosts no video itself.
 *
 * This is `kind: 'embed'` on purpose: the id goes in an <iframe>, and the
 * watch-page URL must never be handed to <video src>, which rejects it with
 * "This source could not be played".
 */
export function trailerSource(media: Media | undefined): MediaSource | null {
  if (!media?.trailerKey) return null;
  return {
    url: `https://www.youtube-nocookie.com/embed/${media.trailerKey}?autoplay=1&rel=0&modestbranding=1`,
    label: 'Official Trailer',
    quality: 'Trailer',
    kind: 'embed',
  };
}

/**
 * Full-length sources from Internet Archive.
 *
 * Kept separate from the trailer on purpose: the archive search is two HTTP
 * round-trips that can be slow or fail, and the player must not sit on a
 * spinner waiting for it when a perfectly good trailer is right there.
 */
export function useArchiveSources(media: Media | undefined) {
  return useQuery({
    queryKey: ['archive-sources', media?.title, media?.year],
    queryFn: async (): Promise<MediaSource[]> => {
      if (!media) return [];
      const hits = await searchArchive(media.title, media.year);
      const found = await Promise.all(hits.slice(0, 3).map(toSource));
      return found.filter((s): s is MediaSource => s !== null);
    },
    enabled: !!media?.title,
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
  });
}

/** Everything playable for a title, full sources first. */
export function mergeSources(archive: MediaSource[], trailer: MediaSource | null): MediaSource[] {
  const list = [...archive];
  if (trailer && !list.some((s) => s.url === trailer.url)) list.push(trailer);
  return list;
}
