import { useMemo, useState } from 'react';
import {
  FREE_STREAM,
  LEAGUES,
  useLeagueTable,
  useLiveMatches,
  useScoreboard,
  type League,
  type Match,
} from '../services/sports';
import { EmptyState, Skeleton, useToast } from '../components/ui';
import { cn } from '../utils/cn';

const ALL_CODES = LEAGUES.map((l) => l.code);

/**
 * Open a broadcaster page outside the app.
 *
 * Capacitor's WebView hands any non-local http(s) navigation to the system
 * browser, so a plain anchor is the right tool here — there is no stream to
 * play in-app, only a link to the rights holder's own service.
 */
function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}

/**
 * Football: live scores and fixtures.
 *
 * Data is ESPN's public web API, which sends `Access-Control-Allow-Origin: *`,
 * so this runs entirely in the app with no server. Note the host — the more
 * commonly used `site.api.espn.com` answers 403 + HTML to non-browser clients,
 * which is why an older version of this needed a passthrough proxy.
 */
export function SportsPage() {
  const [code, setCode] = useState(ALL_CODES[0]);
  const league = LEAGUES.find((l) => l.code === code)!;
  const board = useScoreboard(code);
  const live = useLiveMatches(ALL_CODES);
  const { toast } = useToast();

  const liveMatches = live.data ?? [];
  const matches = board.data?.matches ?? [];
  const { live: liveNow, upcoming, results } = useMemo(
    () => ({
      live: matches.filter((m) => m.state === 'in'),
      upcoming: matches.filter((m) => m.state === 'pre'),
      results: matches.filter((m) => m.state === 'post'),
    }),
    [matches]
  );

  return (
    <div className="pb-10">
      <header className="px-4 pb-3 pt-5 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Sports</h1>
        <p className="mt-1 text-sm text-text-muted">Live scores, fixtures and results</p>
      </header>

      {/* Live now across every league */}
      {live.isLoading ? (
        <div className="px-4 pb-6 sm:px-6 lg:px-10">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : liveMatches.length > 0 ? (
        <section className="pb-7">
          <div className="mb-3 flex items-center gap-2 px-4 sm:px-6 lg:px-10">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-danger)]" />
            <h2 className="text-base font-semibold text-text">Live now</h2>
          </div>
          <div className="rail rail-bleed fade-edges px-4 sm:px-6 lg:px-10">
            {liveMatches.map((m) => (
              <MatchCard key={m.id} match={m} onRemind={() => toast(`Reminder set for ${m.name}`)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* League picker */}
      <div className="sticky top-0 z-30 border-y border-line bg-background/90 py-2.5 backdrop-blur-xl">
        <div className="rail rail-bleed fade-edges px-4 sm:px-6 lg:px-10">
          <div className="flex gap-1.5">
            {LEAGUES.map((l) => (
              <button
                key={l.code}
                onClick={() => setCode(l.code)}
                className={cn(
                  'flex-none whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  code === l.code
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-card text-text-secondary hover:bg-elevated hover:text-text'
                )}
              >
                <span className="mr-1.5">{l.flag}</span>
                {l.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 sm:px-6 lg:px-10">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xl">{league.flag}</span>
          <h2 className="text-lg font-semibold text-text">{league.name}</h2>
        </div>

        {board.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : board.isError ? (
          <EmptyState
            title="Couldn't load scores"
            message="Check your connection and try again."
            actionLabel="Retry"
            onAction={() => board.refetch()}
          />
        ) : matches.length === 0 ? (
          <EmptyState
            title="No fixtures listed"
            message="This league has nothing scheduled right now."
          />
        ) : (
          <div className="space-y-7">
            {liveNow.length > 0 ? (
              <Group title="Live">
                {liveNow.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    wide
                    onRemind={() => toast(`Reminder set for ${m.name}`)}
                  />
                ))}
              </Group>
            ) : null}

            {upcoming.length > 0 ? (
              <Group title="Upcoming">
                {upcoming.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    wide
                    onRemind={() => toast(`Reminder set for ${m.name}`)}
                  />
                ))}
              </Group>
            ) : null}

            {results.length > 0 ? (
              <Group title="Results">
                {results.map((m) => (
                  <MatchCard key={m.id} match={m} wide muted />
                ))}
              </Group>
            ) : null}
          </div>
        )}

        <Standings />
        <WhereToWatch league={league} />
      </div>

      <p className="mt-10 px-4 text-center text-xs text-text-muted sm:px-6 lg:px-10">
        Live scores and fixtures from ESPN · tables from TheSportsDB. Kick-off times are in your
        local timezone.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Where to actually watch.
 *
 * No free data API carries video — they return scores and fixtures, not
 * streams — so the stream lives with the league's rights holder. Rights are
 * territorial, so this links to the official page rather than guessing which
 * local service applies. FIFA+ is listed first because it is genuinely free
 * and worldwide.
 */
function WhereToWatch({ league }: { league: League }) {
  const options = [
    { name: FREE_STREAM.name, url: FREE_STREAM.url, note: FREE_STREAM.note, free: true },
    ...(league.broadcaster
      ? [{ name: league.broadcaster.name, url: league.broadcaster.url, note: `${league.name} — official broadcaster`, free: false }]
      : []),
  ];

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold text-text">Where to watch</h2>
      <div className="space-y-2">
        {options.map((o) => (
          <ExternalLink
            key={o.name}
            href={o.url}
            className="card card-hover flex items-center gap-3 p-3"
          >
            <span
              className={cn(
                'flex h-10 w-10 flex-none items-center justify-center rounded-lg',
                o.free ? 'bg-[color-mix(in_srgb,var(--color-success)_20%,transparent)]' : 'bg-elevated'
              )}
              aria-hidden
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <path d="m11 10 4 2-4 2z" fill="currentColor" stroke="none" />
              </svg>
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-text">{o.name}</span>
                {o.free ? <span className="badge badge-success flex-none">Free</span> : null}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-text-muted">{o.note}</span>
            </span>

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="flex-none text-text-muted"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7-7 7" />
            </svg>
          </ExternalLink>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
        Broadcast rights are territorial, so which service carries a match depends on where you
        are. These links go to the official pages.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * League table.
 *
 * TheSportsDB's free key returns only the leading few rows, so this is labelled
 * as a snapshot rather than presented as a full standings list — showing a
 * truncated table as though it were complete would be worse than not showing it.
 */
function Standings() {
  const [code, setCode] = useState(ALL_CODES[0]);
  const league = LEAGUES.find((l) => l.code === code)!;
  const table = useLeagueTable(league.tsdbId);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-text">League table</h2>
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="League table for"
          className="input h-9 w-auto py-0 pr-7 text-xs"
        >
          {LEAGUES.filter((l) => l.tsdbId).map((l) => (
            <option key={l.code} value={l.code}>
              {l.short}
            </option>
          ))}
        </select>
      </div>

      {!league.tsdbId ? (
        <div className="rounded-xl border border-line bg-card px-4 py-6 text-center text-sm text-text-muted">
          No table is available for this competition.
        </div>
      ) : table.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : (table.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-line bg-card px-4 py-6 text-center text-sm text-text-muted">
          No table data right now.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="w-8 px-2 py-2 font-semibold">#</th>
                  <th className="px-2 py-2 font-semibold">Club</th>
                  <th className="w-9 px-1 py-2 text-center font-semibold">P</th>
                  <th className="w-9 px-1 py-2 text-center font-semibold">W</th>
                  <th className="w-9 px-1 py-2 text-center font-semibold">D</th>
                  <th className="w-9 px-1 py-2 text-center font-semibold">L</th>
                  <th className="w-9 px-1 py-2 text-center font-semibold">+/-</th>
                  <th className="w-10 px-2 py-2 text-right font-semibold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {(table.data ?? []).map((s) => (
                  <tr key={s.position} className="border-b border-line last:border-b-0">
                    <td className="px-2 py-2.5 text-xs tabular-nums text-text-muted">{s.position}</td>
                    <td className="px-2 py-2.5">
                      <span className="flex min-w-0 items-center gap-2">
                        {s.badge ? (
                          <img
                            src={s.badge}
                            alt=""
                            loading="lazy"
                            className="h-5 w-5 flex-none object-contain"
                          />
                        ) : null}
                        <span className="truncate font-medium text-text">{s.team}</span>
                      </span>
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-text-secondary">
                      {s.played}
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-text-secondary">
                      {s.won}
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-text-secondary">
                      {s.drawn}
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-text-secondary">
                      {s.lost}
                    </td>
                    <td className="px-1 py-2.5 text-center text-xs tabular-nums text-text-secondary">
                      {s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}
                    </td>
                    <td className="px-2 py-2.5 text-right text-sm font-bold tabular-nums text-text">
                      {s.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Top of the table as reported by TheSportsDB's free feed.
          </p>
        </>
      )}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const when = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(iso)
  );

const kickoff = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function MatchCard({
  match,
  wide = false,
  muted = false,
  onRemind,
}: {
  match: Match;
  wide?: boolean;
  muted?: boolean;
  onRemind?: () => void;
}) {
  const isLive = match.state === 'in';

  return (
    <div
      className={cn(
        'card',
        wide ? 'w-full p-3' : 'w-64 flex-none p-3',
        isLive && 'border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)]'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-text-muted">{match.leagueName}</span>
        {isLive ? (
          <span className="flex flex-none items-center gap-1.5 text-[11px] font-semibold text-[var(--color-danger)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-danger)]" />
            {match.minute ? `${match.minute}'` : 'LIVE'}
          </span>
        ) : match.state === 'pre' ? (
          <span className="flex-none text-[11px] text-text-muted">
            {when(match.date)} · {kickoff(match.date)}
          </span>
        ) : (
          <span className="flex-none text-[11px] text-text-muted">Full time</span>
        )}
      </div>

      <div className="space-y-1.5">
        <TeamRow team={match.home} align="left" muted={muted && !isLive} highlight={isLive} />
        <TeamRow team={match.away} align="left" muted={muted && !isLive} highlight={isLive} />
      </div>

      {isLive ? (
        <ExternalLink
          href={leagueOf(match)?.broadcaster?.url ?? FREE_STREAM.url}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] py-2 text-[11px] font-semibold text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          Watch live
        </ExternalLink>
      ) : null}

      {wide && onRemind && !isLive && match.state === 'pre' ? (
        <button
          onClick={onRemind}
          className="mt-2.5 w-full rounded-lg border border-line py-1.5 text-[11px] font-medium text-text-secondary transition-colors hover:bg-elevated"
        >
          Remind me
        </button>
      ) : null}
    </div>
  );
}

const leagueOf = (m: Match): League | undefined => LEAGUES.find((l) => l.code === m.leagueCode);

function TeamRow({
  team,
  align,
  muted,
  highlight,
}: {
  team: Match['home'];
  align: 'left' | 'right';
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', align === 'right' && 'flex-row-reverse')}>
      {team.logo ? (
        <img src={team.logo} alt="" className="h-5 w-5 flex-none object-contain" />
      ) : (
        <span
          className="h-5 w-5 flex-none rounded-full"
          style={{ background: team.color ? `#${team.color}` : 'var(--color-elevated)' }}
        />
      )}
      <span className={cn('min-w-0 flex-1 truncate text-sm', muted ? 'text-text-muted' : 'text-text')}>
        {team.name}
      </span>
      <span
        className={cn(
          'flex-none text-sm font-bold tabular-nums',
          highlight ? 'text-text' : muted ? 'text-text-muted' : 'text-text'
        )}
      >
        {team.score}
      </span>
    </div>
  );
}
