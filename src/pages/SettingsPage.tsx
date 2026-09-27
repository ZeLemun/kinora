import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/app-store';
import { Button, Card } from '../components/ui/basic';
import { cn } from '../utils/cn';

export function SettingsPage() {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { theme, setTheme, installedAddons, removeAddon } = useAppStore();

  const themes = [
    { value: 'dark' as const, label: t('dark') },
    { value: 'light' as const, label: t('light') },
    { value: 'system' as const, label: t('system') },
  ];

  return (
    <div className="px-4 py-5">
      <h1 className="mb-5 text-2xl font-bold text-text">{t('settings')}</h1>

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Appearance */}
        <Card className="space-y-4 p-4">
          <h2 className="text-base font-semibold text-text">{t('appearance')}</h2>

          <div>
            <label className="mb-2 block text-sm text-text-muted">{t('theme')}</label>
            <div className="flex gap-2">
              {themes.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setTheme(item.value)}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                    theme === item.value
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-surface text-text-muted'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-text-muted">{t('language')}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as never)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Add-ons */}
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text">{t('addons')}</h2>
            <Link to="/addons">
              <Button size="sm" variant="secondary">
                {t('manage')}
              </Button>
            </Link>
          </div>

          {installedAddons.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-muted">{t('noAddons')}</p>
          ) : (
            <ul className="space-y-2">
              {installedAddons.map((addon) => (
                <li
                  key={addon.transportUrl}
                  className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text">{addon.manifest.name}</p>
                    <p className="truncate text-xs text-text-muted">{addon.transportUrl}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAddon(addon.transportUrl)}
                    className="flex-none text-error"
                  >
                    {t('remove')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* About */}
        <Card className="space-y-1.5 p-4 text-sm text-text-muted">
          <h2 className="mb-1 text-base font-semibold text-text">{t('about')}</h2>
          <p>Kinora v1.0.0</p>
          <p className="text-xs">
            {t('version')} 1.0.0 · React · TypeScript · Tailwind · Capacitor
          </p>
          <p className="text-xs">
            Add-on engine:{' '}
            <a
              href="https://github.com/Stremio/stremio-core-web"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              stremio-core-web
            </a>{' '}
            (MIT) · Metadata:{' '}
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              TMDB
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
