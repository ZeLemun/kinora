import { cn } from '../utils/cn';
import type { MediaSource } from '../store/app-store';
import type { Probe, ProbeState } from '../services/probe';

const STATE_COPY: Record<ProbeState, { label: string; className: string }> = {
  pending: { label: 'Waiting', className: 'text-text-muted' },
  testing: { label: 'Testing', className: 'text-white/70' },
  ok: { label: 'Ready', className: 'text-[var(--color-success)]' },
  unknown: { label: 'Unverified', className: 'text-[var(--color-warning)]' },
  failed: { label: 'Unavailable', className: 'text-[var(--color-danger)]' },
};

function StatusIcon({ state }: { state: ProbeState }) {
  if (state === 'testing' || state === 'pending') {
    return (
      <span
        className={cn(
          'h-4 w-4 flex-none rounded-full border-2 border-white/20 border-t-white',
          state === 'testing' && 'animate-spin'
        )}
        aria-hidden
      />
    );
  }
  if (state === 'ok') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-none text-[var(--color-success)]" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  if (state === 'unknown') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-[var(--color-warning)]" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-[var(--color-danger)]" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * The source chooser.
 *
 * Lists every candidate with the result of its health check, so a failed source
 * is visibly failed rather than silently skipped, and the viewer can override
 * the automatic choice. Also used as the "testing sources" screen: the rows
 * animate through pending → testing → ready in place.
 */
export function SourceChooser({
  sources,
  probes,
  activeUrl,
  checking,
  onPick,
  onClose,
  embedded = false,
}: {
  sources: MediaSource[];
  probes: Record<string, Probe>;
  activeUrl?: string;
  checking: boolean;
  onPick: (source: MediaSource) => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  if (sources.length === 0) return null;

  const ready = sources.filter(
    (s) => s.kind === 'embed' || ['ok', 'unknown'].includes(probes[s.url]?.state ?? 'pending')
  ).length;

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-black/85 p-3 shadow-2xl backdrop-blur-xl',
        embedded ? 'w-full' : 'w-[min(92%,26rem)]'
      )}
      role="group"
      aria-label="Available sources"
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {checking ? 'Finding the best source…' : 'Sources'}
        </p>
        <p className="text-[11px] tabular-nums text-white/45">
          {ready} of {sources.length} available
        </p>
      </div>

      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {sources.map((s) => {
          const state: ProbeState = s.kind === 'embed' ? 'ok' : probes[s.url]?.state ?? 'pending';
          const copy = STATE_COPY[state];
          const active = s.url === activeUrl;
          const dead = state === 'failed';

          return (
            <li key={s.url}>
              <button
                onClick={() => !dead && onPick(s)}
                disabled={dead}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-white/15' : dead ? 'opacity-50' : 'hover:bg-white/10'
                )}
              >
                <StatusIcon state={state} />

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'badge flex-none',
                        s.kind === 'embed'
                          ? 'badge-default'
                          : state === 'ok'
                            ? 'badge-success'
                            : state === 'unknown'
                              ? 'badge-warning'
                              : 'badge-default'
                      )}
                    >
                      {s.quality ?? 'HD'}
                    </span>
                    <span className="truncate text-sm text-white">{s.label}</span>
                  </span>
                  {probes[s.url]?.note ? (
                    <span className="mt-0.5 block truncate text-[11px] text-white/45">
                      {probes[s.url]?.note}
                    </span>
                  ) : null}
                </span>

                <span className={cn('flex-none text-[11px]', copy.className)}>{copy.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {onClose ? (
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg bg-white/10 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
        >
          Close
        </button>
      ) : null}
    </div>
  );
}
