import { useState } from 'react';
import { useAppStore, type Settings } from '../store/app-store';
import { ConfirmDialog, Modal, useToast } from '../components/ui';
import { ShortcutHint } from '../components/VideoPlayer';
import { cn } from '../utils/cn';

const SHORTCUTS = [
  { key: 'Space', label: 'Play / pause' },
  { key: 'K', label: 'Play / pause' },
  { key: '←', label: 'Back 10 seconds' },
  { key: '→', label: 'Forward 10 seconds' },
  { key: 'J', label: 'Back 30 seconds' },
  { key: 'L', label: 'Forward 30 seconds' },
  { key: 'M', label: 'Mute / unmute' },
  { key: 'Esc', label: 'Exit the player' },
  { key: '⌘K', label: 'Focus search' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Español' },
];

export function SettingsPage() {
  const { settings, updateSettings, resetAll, progress, watchlist, favorites, history } = useAppStore();
  const { toast } = useToast();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="pb-24">
      <header className="px-4 pb-4 pt-5 sm:px-6 lg:px-10">
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Settings</h1>
      </header>

      <div className="space-y-6 px-4 sm:px-6 lg:px-10">
        {/* Appearance */}
        <Section title="Appearance">
          <Row label="Theme">
            <div className="flex gap-1 rounded-lg bg-card p-1">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                    settings.theme === t ? 'bg-elevated text-text' : 'text-text-muted hover:text-text'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Language">
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              aria-label="Language"
              className="input h-9 w-auto py-0 pr-8 text-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Playback */}
        <Section title="Playback">
          <Toggle
            label="Autoplay next episode"
            hint="Start the next episode as soon as one ends"
            checked={settings.autoplayNextEpisode}
            onChange={(v) => updateSettings({ autoplayNextEpisode: v })}
          />
          <Toggle
            label="Remember position"
            hint="Resume where you stopped watching"
            checked={settings.rememberPosition}
            onChange={(v) => updateSettings({ rememberPosition: v })}
          />
          <Toggle
            label="Skip intro by default"
            hint="Jump past the opening automatically"
            checked={settings.skipIntro}
            onChange={(v) => updateSettings({ skipIntro: v })}
          />
          <Row label="Default quality">
            <select
              value={settings.defaultQuality}
              onChange={(e) => updateSettings({ defaultQuality: e.target.value as Settings['defaultQuality'] })}
              aria-label="Default quality"
              className="input h-9 w-auto py-0 pr-8 text-xs"
            >
              {['auto', '1080p', '720p', '480p'].map((q) => (
                <option key={q} value={q}>
                  {q === 'auto' ? 'Auto' : q}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Toggle
            label="New content"
            hint="Tell me when something new is added"
            checked={settings.newContentNotifications}
            onChange={(v) => updateSettings({ newContentNotifications: v })}
          />
          <Toggle
            label="Continue watching reminders"
            hint="Nudge me about things I left part-watched"
            checked={settings.continueWatchingReminders}
            onChange={(v) => updateSettings({ continueWatchingReminders: v })}
          />
        </Section>

        {/* Data */}
        <Section title="Your data">
          <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
            <Stat label="In progress" value={Object.keys(progress).length} />
            <Stat label="Watchlist" value={watchlist.length} />
            <Stat label="Favorites" value={favorites.length} />
            <Stat label="History" value={history.length} />
          </div>

          <button
            onClick={() => setShowShortcuts(true)}
            className="flex w-full items-center justify-between border-t border-line py-3.5 text-left text-sm text-text transition-colors hover:bg-elevated/50"
          >
            <span>Keyboard shortcuts</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => setConfirmReset(true)}
            className="flex w-full items-center justify-between border-t border-line py-3.5 text-left text-sm text-[var(--color-danger)] transition-colors hover:bg-elevated/50"
          >
            <span>Reset all data</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Section>

        <p className="pt-2 text-center text-xs text-text-muted">
          Kinora 1.0.0 · metadata by TMDB
        </p>
      </div>

      <Modal
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="Keyboard shortcuts"
        size="lg"
      >
        <ShortcutHint items={SHORTCUTS} />
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        message="This clears your watch progress, watchlist, favorites, history and settings. It cannot be undone."
        confirmLabel="Reset everything"
        cancelLabel="Cancel"
        onConfirm={() => {
          resetAll();
          setConfirmReset(false);
          toast('All data cleared', 'success');
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div className="rounded-xl border border-line bg-card px-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3.5 last:border-b-0">
      <span className="text-sm text-text">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-text">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 flex-none rounded-full transition-colors',
          checked ? 'bg-[var(--color-accent)]' : 'bg-elevated'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-elevated/50 px-3 py-2.5">
      <p className="text-lg font-bold tabular-nums text-text">{value}</p>
      <p className="text-[11px] text-text-muted">{label}</p>
    </div>
  );
}
