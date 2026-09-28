import { useEffect, useMemo, useRef, useState } from 'react';
import type { MediaSource } from '../store/app-store';
import {
  bestSource,
  probeSource,
  rankSources,
  type Probe,
  type ProbeState,
} from '../services/probe';

/**
 * Health-checks every candidate source, then picks the best one.
 *
 * <video> cannot recover from a source that turns out to be dead — it fires
 * `error` once and the screen is stuck. Checking first costs a few hundred
 * milliseconds of a 1 KB range request per source and avoids that entirely.
 *
 * An `embed` source is never probed: it is a page for an <iframe>, and asking
 * the host to serve it as a byte range would fail for reasons that say nothing
 * about whether it works.
 */
export function useSourcePicker(sources: MediaSource[], enabled: boolean) {
  const [probes, setProbes] = useState<Record<string, Probe>>({});
  const [checking, setChecking] = useState(false);
  const startedFor = useRef<string>('');

  // A stable key for "the same set of candidate URLs".
  const key = useMemo(() => sources.map((s) => s.url).join('|'), [sources]);

  useEffect(() => {
    if (!enabled || sources.length === 0) return;
    if (startedFor.current === key) return;
    startedFor.current = key;

    const controller = new AbortController();
    setChecking(true);
    setProbes({});

    // Only real video files are probed.
    const playable = sources.filter((s) => s.kind === 'free');
    if (playable.length === 0) {
      setChecking(false);
      return () => controller.abort();
    }

    for (const s of playable) {
      setProbes((p) => ({ ...p, [s.url]: { state: 'pending' } }));
    }

    (async () => {
      // Two at a time: enough to be quick, few enough not to look like a burst
      // of requests to a host that is only serving us one file anyway.
      const queue = [...playable];
      const worker = async () => {
        for (;;) {
          const next = queue.shift();
          if (!next) return;
          setProbes((p) => ({ ...p, [next.url]: { state: 'testing' } }));
          const result = await probeSource(next, controller.signal);
          setProbes((p) => ({ ...p, [next.url]: result }));
        }
      };
      await Promise.all([worker(), worker()]);
      if (!controller.signal.aborted) setChecking(false);
    })();

    return () => controller.abort();
  }, [key, enabled]);

  /** Every source, best first. `embed` entries sort last. */
  const ranked = useMemo(() => rankWithEmbeds(sources, probes), [key, probes]);

  /** The first source that passed, else the first un-failed one. */
  const best = useMemo(() => pickBest(sources, probes), [key, probes]);

  const counts = useMemo(() => sources.reduce(
    (acc, s) => {
      const state: ProbeState = s.kind === 'embed' ? 'ok' : probes[s.url]?.state ?? 'pending';
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<ProbeState, number>>
  ), [key, probes]);

  return { probes, checking, ranked, best, counts };
}

function rankWithEmbeds(sources: MediaSource[], probes: Record<string, Probe>): MediaSource[] {
  const files = sources.filter((s) => s.kind === 'free');
  const embeds = sources.filter((s) => s.kind === 'embed');
  return [...rankSources(files, probes), ...embeds];
}

function pickBest(sources: MediaSource[], probes: Record<string, Probe>): MediaSource | undefined {
  const files = sources.filter((s) => s.kind === 'free');
  // An embed always works, so it is the floor when no file survives.
  if (files.length === 0) return sources.find((s) => s.kind === 'embed');

  const winner = bestSource(files, probes);
  if (winner && probes[winner.url]?.state !== 'failed') return winner;
  return sources.find((s) => s.kind === 'embed') ?? winner;
}
