import { useQuery } from '@tanstack/react-query';

/**
 * Football live scores + fixtures.
 *
 * ESPN's public web API answers with `Access-Control-Allow-Origin: *`, so the
 * app can call it directly with no proxy and no server. Note the host: the
 * commonly-used `site.api.espn.com` returns 403 + HTML to non-browser clients,
 * which is why the old server.cjs needed a passthrough. `site.web.api.espn.com`
 * does not.
 */

const BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer';

/**
 * League tables and badges come from TheSportsDB.
 *
 * ESPN covers live state far better, but has no league table and no crests.
 * TheSportsDB's free key (`3`, their documented public test key) answers with
 * `Access-Control-Allow-Origin: *`, so it works from the WebView with no proxy
 * and no account.
 *
 * Verified working, free tier: all_leagues, lookuptable, eventsnextleague,
 * searchteams. Their v2 API needs a paid key and 404s.
 */
const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';

export interface League {
  code: string;
  name: string;
  short: string;
  country: string;
  flag: string;
  /** TheSportsDB league id, for tables. Absent where the free tier has none. */
  tsdbId?: string;
  /**
   * The league's official broadcaster, which is where the stream actually
   * lives. Rights are territorial, so this is a starting point rather than a
   * guarantee — the link goes to the broadcaster's own page, which will show
   * the correct local service.
   */
  broadcaster?: { name: string; url: string };
}

export const LEAGUES: League[] = [
  { code: 'eng.1', name: 'Premier League', short: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tsdbId: '4328', broadcaster: { name: 'Premier League TV', url: 'https://www.premierleague.com/broadcast-schedules' } },
  { code: 'esp.1', name: 'LaLiga', short: 'LaLiga', country: 'Spain', flag: '🇪🇸', tsdbId: '4335', broadcaster: { name: 'LaLiga TV', url: 'https://www.laliga.com/en-GB/laliga-easports' } },
  { code: 'ita.1', name: 'Serie A', short: 'Serie A', country: 'Italy', flag: '🇮🇹', tsdbId: '4332', broadcaster: { name: 'Serie A', url: 'https://en.legaseriea.it/' } },
  { code: 'ger.1', name: 'Bundesliga', short: 'Bundesliga', country: 'Germany', flag: '🇩🇪', tsdbId: '4331', broadcaster: { name: 'Bundesliga', url: 'https://www.bundesliga.com/en/bundesliga/watch' } },
  { code: 'fra.1', name: 'Ligue 1', short: 'Ligue 1', country: 'France', flag: '🇫🇷', tsdbId: '4334', broadcaster: { name: 'Ligue 1', url: 'https://ligue1.com/' } },
  { code: 'por.1', name: 'Primeira Liga', short: 'Primeira Liga', country: 'Portugal', flag: '🇵🇹', tsdbId: '4344' },
  { code: 'ned.1', name: 'Eredivisie', short: 'Eredivisie', country: 'Netherlands', flag: '🇳🇱', tsdbId: '4337' },
  { code: 'sco.1', name: 'Scottish Premiership', short: 'Scotland', country: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tsdbId: '4330' },
  { code: 'mex.1', name: 'Liga MX', short: 'Liga MX', country: 'Mexico', flag: '🇲🇽', tsdbId: '4350' },
  { code: 'arg.1', name: 'Primera División', short: 'Argentina', country: 'Argentina', flag: '🇦🇷', tsdbId: '4406' },
  { code: 'bra.1', name: 'Brasileirão', short: 'Brasileirão', country: 'Brazil', flag: '🇧🇷', tsdbId: '4351' },
  { code: 'uefa.champions', name: 'Champions League', short: 'UCL', country: 'Europe', flag: '🇪🇺', broadcaster: { name: 'UEFA', url: 'https://www.uefa.com/uefachampionsleague/' } },
  { code: 'uefa.europa', name: 'Europa League', short: 'UEL', country: 'Europe', flag: '🇪🇺', broadcaster: { name: 'UEFA', url: 'https://www.uefa.com/uefaeuropaleague/' } },
  { code: 'uefa.europa.conf', name: 'Conference League', short: 'UECL', country: 'Europe', flag: '🇪🇺', broadcaster: { name: 'UEFA', url: 'https://www.uefa.com/uefaconferenceleague/' } },
  { code: 'usa.1', name: 'Major League Soccer', short: 'MLS', country: 'USA', flag: '🇺🇸', broadcaster: { name: 'Apple TV+', url: 'https://www.mlssoccer.com/mls-season-pass/' } },
];

/**
 * FIFA+ is genuinely free and worldwide, with a real full-match archive —
 * World Cup and qualifiers, women's football, youth and beach soccer. It is the
 * one place on this list where a complete, legal, no-account stream exists.
 */
export const FREE_STREAM = {
  name: 'FIFA+',
  url: 'https://www.fifa.com/en/fifaplus',
  note: 'Free worldwide — full matches, no account needed',
};

export type MatchState = 'pre' | 'in' | 'post';

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
  logo?: string;
  color?: string;
  score: number;
}

export interface Match {
  id: string;
  leagueCode: string;
  leagueName: string;
  name: string;
  date: string;
  state: MatchState;
  minute?: number;
  home: Team;
  away: Team;
  venue?: string;
  statusDetail?: string;
}

function mapTeam(c: any): Team {
  return {
    id: c?.team?.id ?? '',
    name: c?.team?.displayName ?? c?.team?.name ?? 'TBC',
    abbreviation: c?.team?.abbreviation ?? '',
    logo: c?.team?.logo,
    color: c?.team?.color,
    score: Number(c?.score ?? 0) || 0,
  };
}

async function fetchLeague(code: string): Promise<{ leagueName: string; matches: Match[] }> {
  const res = await fetch(`${BASE}/${code}/scoreboard`);
  if (!res.ok) throw new Error(`scoreboard ${res.status}`);
  const json = await res.json();
  const leagueName = json.leagues?.[0]?.name ?? code;

  const matches: Match[] = (json.events ?? []).map((e: any) => {
    const comp = e.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');
    const state: MatchState = e.status?.type?.state ?? 'pre';
    return {
      id: e.id,
      leagueCode: code,
      leagueName,
      name: e.name,
      date: e.date,
      state,
      minute: e.status?.displayClock ? Number(String(e.status.displayClock).replace(/\D/g, '')) || undefined : undefined,
      statusDetail: e.status?.type?.detail,
      venue: comp?.venue?.fullName,
      home: mapTeam(home),
      away: mapTeam(away),
    };
  });

  // Live first, then soonest upcoming, then most recent results.
  const rank = (m: Match) => (m.state === 'in' ? 0 : m.state === 'pre' ? 1 : 2);
  matches.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const ta = new Date(a.date).getTime();
    const tb = new Date(b.date).getTime();
    return rank(a) === 2 ? tb - ta : ta - tb;
  });

  return { leagueName, matches };
}

export function useScoreboard(code: string) {
  return useQuery({
    queryKey: ['sports', 'scoreboard', code],
    queryFn: () => fetchLeague(code),
    // Live scores go stale fast; poll while the tab is visible.
    staleTime: 30_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** Live matches across every league, for the "Live now" row. */
export function useLiveMatches(codes: string[]) {
  return useQuery({
    queryKey: ['sports', 'live', codes.join(',')],
    queryFn: async (): Promise<Match[]> => {
      const results = await Promise.allSettled(codes.map((c) => fetchLeague(c)));
      const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value.matches : []));
      return all
        .filter((m) => m.state === 'in')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

/* ------------------------------------------------------------------ */
/*  League table (TheSportsDB)                                         */
/* ------------------------------------------------------------------ */

export interface Standing {
  position: number;
  team: string;
  badge?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string;
}

/**
 * The free tier returns only a handful of rows per league (five, in practice),
 * so the caller should present it as a snapshot of the top of the table rather
 * than a complete standings list.
 */
export function useLeagueTable(tsdbId: string | undefined) {
  return useQuery({
    queryKey: ['sports', 'table', tsdbId],
    queryFn: async (): Promise<Standing[]> => {
      if (!tsdbId) return [];
      const res = await fetch(`${TSDB}/lookuptable.php?l=${encodeURIComponent(tsdbId)}`);
      if (!res.ok) return [];
      const json = await res.json();
      const rows: any[] = Array.isArray(json.table) ? json.table : [];

      return rows
        .map((r) => ({
          position: Number(r.intRank) || 0,
          team: r.strTeam ?? '—',
          badge: r.strBadge ?? undefined,
          played: Number(r.intPlayed) || 0,
          won: Number(r.intWin) || 0,
          drawn: Number(r.intDraw) || 0,
          lost: Number(r.intLoss) || 0,
          goalsFor: Number(r.intGoalsFor) || 0,
          goalsAgainst: Number(r.intGoalsAgainst) || 0,
          goalDifference: Number(r.intGoalDiff) || 0,
          points: Number(r.intPoints) || 0,
          form: r.strForm || undefined,
        }))
        .sort((a, b) => a.position - b.position);
    },
    enabled: !!tsdbId,
    staleTime: 30 * 60_000,
    retry: 1,
  });
}
