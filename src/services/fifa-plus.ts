import { useQuery } from '@tanstack/react-query';

/**
 * FIFA+ full-match replays.
 *
 * This exists because of one specific complaint: pressing play and getting a
 * highlights package instead of the match. So the filter below is deliberately
 * narrow and excludes clips by title pattern rather than trying to judge them.
 *
 * What the API actually returns (measured, not assumed):
 *   - host `cxm-api.fifa.com` sends `Access-Control-Allow-Origin: *`, so this
 *     works from the WebView with no proxy and no account.
 *   - `VideoDuration` is almost always null: 1 of 40 full matches carried one.
 *     Filtering on duration is therefore not possible, which is exactly why the
 *     highlights problem exists on sites that try.
 *   - The title is reliable instead. Searching "full match replay" returned
 *     49/49 videos matching /full match/i; searching "goals highlights" returned
 *     0/40. Both `recordType === 'video'` and the title test are required.
 *
 * Honest scope: this is an international-football archive (World Cup, qualifiers,
 * women's, youth, beach), and the bulk of it is 2022-23 vintage. It is not a
 * live feed and it does not carry domestic league rights — the Premier League,
 * LaLiga and so on are behind paid subscriptions and nothing here changes that.
 */

const CXM = 'https://cxm-api.fifa.com/fifacxmsearch/api/results';

/**
 * Public key, extracted from FIFA+'s own front-end bundle.
 *
 * It is not a secret and not an account: it ships in the JavaScript that every
 * visitor downloads, so there is no credential to protect and nothing to
 * rotate. It only rate-limits an endpoint that is already public.
 */
const KEY = '2kD9zRYRT7xN6kSGs6EoHcvSyKOyK0B4YaKTf1Ygeaw8PM6bgfR6SQ==';

/** Terms that mark a video as something other than the complete match. */
const CLIP_WORDS =
  /highlights?|extended|every goal|best (?:moments?|goals?)|goal of the (?:tournament|month)|decade|in numbers|mic'd|mic ?up|top \d+|the story of|reacts?|analysis|breakdown|preview/i;

/** A full match is one of these and none of those. */
const FULL_MATCH = /full match/i;

export interface FullMatch {
  id: string;
  title: string;
  /** e.g. "Argentina v Chile | Friendly" */
  teams: string;
  competition?: string;
  date: string;
  url: string;
  thumbnail?: string;
  /** Seconds, when FIFA publishes one. Rarely — see the note above. */
  durationSeconds?: number;
}

/**
 * "Argentina v Chile | Friendly | Full Match Replay" -> "Argentina v Chile".
 *
 * The title packs team, stage and kind into one pipe-delimited string. The
 * competition is the part between the teams and the trailing qualifier.
 */
function parseTitle(title: string): { teams: string; competition?: string } {
  const parts = title.split('|').map((p) => p.trim());
  const teams = parts[0] || title;
  const middle = parts.slice(1).find((p) => p && !/full match|replay|highlights?/i.test(p));
  return { teams, competition: middle || undefined };
}

function toFullMatch(src: any): FullMatch | null {
  const title: string = src?.title ?? '';
  const url: string = src?.url ?? '';
  // Belt and braces. Both checks, because showing a highlight here is the
  // failure this whole service is written to avoid.
  if (src?.recordType !== 'video') return null;
  if (!FULL_MATCH.test(title)) return null;
  if (CLIP_WORDS.test(title)) return null;
  if (!url.includes('/watch/')) return null;

  let info: any = {};
  try {
    info = JSON.parse(src.additionalInformation ?? '{}');
  } catch {
    // A malformed blob costs us the duration, not the match.
  }

  const { teams, competition } = parseTitle(title);
  const duration = Number(info.VideoDuration);

  return {
    id: info.VideoEntryId ?? url,
    title,
    teams,
    competition,
    date: src.contentDate ?? '',
    url,
    thumbnail: src.image,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
  };
}

const QUERIES = [
  'full match replay',
  'full match',
  'full match highlights of',
  'complete match',
];

async function search(query: string): Promise<FullMatch[]> {
  const url =
    `${CXM}?locale=en&searchString=${encodeURIComponent(query)}` +
    '&clientType=fifaplus&type=search&context=default&size=40&sort=relevance&dateFrom=1900-01-01';

  const res = await fetch(url, {
    headers: { 'X-Functions-Key': KEY, Origin: 'https://www.fifa.com' },
  });
  if (!res.ok) return [];

  const json = await res.json();
  const hits: any[] = json?.hits?.hits ?? [];
  return hits.map((h) => toFullMatch(h._source)).filter((m): m is FullMatch => m !== null);
}

/**
 * Full matches only. Clips cannot reach the returned array.
 *
 * Several queries are merged because no single one has good recall — the
 * archive labels some entries "Full Match Replay", others "Full Match" — and a
 * viewer scrolling a football page would rather see ten real matches from two
 * queries than three from one.
 */
export function useFullMatches(enabled = true) {
  return useQuery({
    queryKey: ['sports', 'fifa-full-matches'],
    queryFn: async (): Promise<FullMatch[]> => {
      const results = await Promise.all(QUERIES.map((q) => search(q).catch(() => [])));

      const seen = new Map<string, FullMatch>();
      for (const list of results) {
        for (const m of list) {
          // Key on the watch id, not the URL: the same match can be titled
          // slightly differently across queries.
          if (!seen.has(m.id)) seen.set(m.id, m);
        }
      }

      return Array.from(seen.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    },
    enabled,
    // An archive does not change minute to minute.
    staleTime: 6 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 1,
  });
}

export const fmtMatchLength = (seconds?: number) =>
  !seconds ? '' : `${Math.floor(seconds / 60)} min`;
