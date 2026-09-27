import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/app-store';
import { Button, Input, Card, Badge } from '../components/ui/basic';
import { EmptyState } from '../components/ErrorFallback';
import { cn } from '../utils/cn';
import type { AddonConfig, InstalledAddon, Manifest } from '../addon-types';
import { AddonConfigForm } from '../components/AddonConfigForm';

/** Flattens the two manifest resource shapes into plain names. */
function resourceNames(addon: Pick<InstalledAddon, 'manifest'>): string[] {
  return (addon.manifest.resources ?? [])
    .map((r) => (typeof r === 'string' ? r : r.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
}

const SUGGESTED = [
  {
    name: 'AIOStreams',
    url: 'https://aiostreams.elfhosted.com',
    desc: 'Meta add-on that aggregates the others. Configure a debrid provider.',
  },
  {
    name: 'Comet',
    url: 'https://comet.elfhosted.com',
    desc: 'Fast torrent/debrid search. Needs a debrid provider for playback.',
  },
  {
    name: 'MediaFusion',
    url: 'https://mediafusion.elfhosted.com',
    desc: 'Highly filterable. Needs a debrid provider for playback.',
  },
  {
    name: 'Torrentio',
    url: 'https://torrentio.strem.fun',
    desc: 'Torrent indexer aggregator. Torrents cannot be played in-app.',
  },
  {
    name: 'Cinemeta',
    url: 'https://v3-cinemeta.strem.io',
    desc: 'Official catalog, metadata and streams',
  },
  {
    name: 'OpenSubtitles',
    url: 'https://opensubtitles.com/stremio',
    desc: 'Subtitles for movies and episodes',
  },
];

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** Fetches a Stremio manifest and normalises it into our Manifest shape. */
async function fetchManifest(input: string): Promise<Manifest> {
  const url = input.trim();
  if (!url) throw new Error('Empty URL');
  const candidate = url.endsWith('.json') ? url : `${url.replace(/\/+$/, '')}/manifest.json`;

  const res = await fetch(candidate, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = (await res.json()) as Record<string, unknown>;

  if (typeof raw.id !== 'string' || !raw.id) throw new Error('Manifest has no id');
  if (!Array.isArray(raw.resources)) throw new Error('Manifest has no resources');

  return {
    id: raw.id,
    version: typeof raw.version === 'string' ? raw.version : '0.0.0',
    name: typeof raw.name === 'string' ? raw.name : raw.id,
    description: typeof raw.description === 'string' ? raw.description : '',
    resources: raw.resources.filter((r): r is string => typeof r === 'string'),
    types: Array.isArray(raw.types) ? (raw.types.filter((x) => typeof x === 'string') as string[]) : [],
    idPrefixes: Array.isArray(raw.idPrefixes)
      ? (raw.idPrefixes.filter((x) => typeof x === 'string') as string[])
      : undefined,
    catalogs: Array.isArray(raw.catalogs)
      ? (raw.catalogs.filter((c) => c && typeof c === 'object') as Manifest['catalogs'])
      : undefined,
    behaviorHints:
      raw.behaviorHints && typeof raw.behaviorHints === 'object'
        ? (raw.behaviorHints as Manifest['behaviorHints'])
        : undefined,
  };
}

export function AddonsPage() {
  const { t } = useTranslation();
  const { installedAddons, addAddon, removeAddon, toggleAddon, setAddonConfig } = useAppStore();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [configFields, setConfigFields] = useState<AddonConfig[] | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const installedUrls = new Set(installedAddons.map((a) => a.transportUrl.replace(/\/+$/, '')));
  const isInstalled = (transport: string) => installedUrls.has(transport.replace(/\/+$/, ''));

  const check = async (value: string) => {
    if (!value.trim()) return;
    setStatus('loading');
    setError(null);
    setManifest(null);
    try {
      setManifest(await fetchManifest(value));
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manifest');
      setStatus('error');
    }
  };

  const install = () => {
    if (!manifest) return;
    const transportUrl = url.trim().replace(/\/+$/, '').replace(/\/manifest\.json$/, '');
    addAddon({ manifest, transportUrl, enabled: true });
    setUrl('');
    setManifest(null);
    setStatus('idle');
  };

  /** Opens an add-on's /configure manifest and shows its form. */
  const openConfig = async (transportUrl: string) => {
    setConfiguring(transportUrl);
    setConfigFields(null);
    setConfigError(null);
    try {
      const res = await fetch(`${transportUrl.replace(/\/+$/, '')}/configure`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { config?: AddonConfig[] };
      if (!Array.isArray(data.config) || data.config.length === 0) {
        throw new Error(t('noConfigFields'));
      }
      setConfigFields(data.config);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to load configuration');
    }
  };

  return (
    <div className="px-4 py-5">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/settings" className="rounded-full p-2 text-text-muted hover:bg-surface">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-text">{t('addons')}</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Install */}
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-text">{t('installAddon')}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check(url);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('addonUrlPlaceholder')}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setStatus('idle');
                setManifest(null);
                setError(null);
              }}
              disabled={status === 'loading'}
              className="min-w-0 flex-1 px-3 py-2.5 font-mono text-sm"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!url.trim() || status === 'loading'}
              className="flex-none"
            >
              {status === 'loading' ? t('loading') : t('testConnection')}
            </Button>
          </form>

          {status === 'ready' && manifest && (
            <div className="space-y-2 rounded-lg bg-surface p-3">
              <p className="text-sm font-medium text-text">{manifest.name}</p>
              {manifest.description && (
                <p className="text-xs leading-relaxed text-text-muted">{manifest.description}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {resourceNames({ manifest }).map((r) => (
                  <Badge key={r} variant="primary">
                    {r}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={install}>
                  {t('installAddon')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus('idle')}>
                  {t('close')}
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <p className="text-sm text-error">
              {t('error')}: {error}
            </p>
          )}
        </Card>

        {/* Installed */}
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-text">{t('installedAddons')}</h2>

          {installedAddons.length === 0 ? (
            <EmptyState
              title={t('noAddons')}
              icon={
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                </svg>
              }
            />
          ) : (
            <ul className="space-y-2">
              {installedAddons.map((addon) => {
                const active = addon.enabled !== false;
                return (
                  <li
                    key={addon.transportUrl}
                    className={cn(
                      'rounded-lg border border-border bg-surface p-3 transition-opacity',
                      !active && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-text">{addon.manifest.name}</p>
                        <p className="truncate text-xs text-text-muted">{addon.transportUrl}</p>
                      </div>
                      <Badge variant={active ? 'success' : 'default'}>
                        {active ? t('enable') : t('disable')}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {resourceNames(addon).map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                    </div>

                    {!!addon.manifest.catalogs?.length && (
                      <p className="mt-2 text-xs text-text-muted">
                        {addon.manifest.catalogs.length} {t('catalogs')}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => toggleAddon(addon.transportUrl)}>
                        {active ? t('disable') : t('enable')}
                      </Button>
                      {addon.manifest.behaviorHints?.configurable && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openConfig(addon.transportUrl)}
                        >
                          {t('configure')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAddon(addon.transportUrl)}
                        className="text-error"
                      >
                        {t('remove')}
                      </Button>
                    </div>

                    {configuring === addon.transportUrl && (
                      <div className="mt-2">
                        {configError ? (
                          <p className="text-xs text-error">
                            {t('error')}: {configError}
                          </p>
                        ) : configFields ? (
                          <AddonConfigForm
                            transportUrl={addon.transportUrl}
                            fields={configFields}
                            initial={addon.config ?? {}}
                            saveLabel={t('save')}
                            cancelLabel={t('close')}
                            onCancel={() => {
                              setConfiguring(null);
                              setConfigFields(null);
                            }}
                            onSave={(cfg) => {
                              setAddonConfig(addon.transportUrl, cfg);
                              setConfiguring(null);
                              setConfigFields(null);
                            }}
                          />
                        ) : (
                          <p className="text-xs text-text-muted">{t('loading')}</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Suggested */}
        <Card className="space-y-3 p-4">
          <h2 className="text-base font-semibold text-text">{t('discoverAddons')}</h2>
          <ul className="space-y-2">
            {SUGGESTED.map((addon) => {
              const already = isInstalled(addon.url);
              return (
                <li
                  key={addon.name}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{addon.name}</p>
                    <p className="truncate text-xs text-text-muted">{addon.desc}</p>
                  </div>
                  {already ? (
                    <Badge variant="success">{t('installed')}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-none"
                      onClick={() => {
                        setUrl(addon.url);
                        check(addon.url);
                      }}
                    >
                      {t('add')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
