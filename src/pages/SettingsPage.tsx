import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/app-store';
import { Button, Input, Card } from '../components/ui/basic';
import { cn } from '../utils/cn';
import { useState } from 'react';

export function SettingsPage() {
  const { t, language, setLanguage, availableLanguages } = useTranslation();
  const { theme, setTheme, serverUrl, setServerUrl, installedAddons, removeAddon } = useAppStore();
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    if (!serverUrl) return;
    setTestResult('testing');
    try {
      const response = await fetch(`${serverUrl}/api/health`);
      if (response.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold text-text">{t('settings') || 'Settings'}</h1>

        <Card className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-text">{t('appearance') || 'Appearance'}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">{t('theme') || 'Theme'}</label>
              <div className="flex gap-2">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                      theme === t
                        ? 'bg-primary text-white'
                        : 'bg-surface text-text hover:bg-surface-hover border border-border'
                    )}
                  >
                    {t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">{t('language') || 'Language'}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg bg-surface border border-border text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-text">{t('serverUrl') || 'Server URL'}</h2>
          <p className="text-sm text-text-muted">
            Optional: Connect to your Termux server for HLS proxy support
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder={t('serverUrlPlaceholder') || 'http://your-phone:3000'}
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
            <Button onClick={handleTestConnection} disabled={!serverUrl || testResult === 'testing'}>
              {testResult === 'testing' ? 'Testing...' : t('testConnection') || 'Test Connection'}
            </Button>
          </div>
          {testResult === 'success' && (
            <p className="text-sm text-success">{t('connected') || 'Connected'}</p>
          )}
          {testResult === 'error' && (
            <p className="text-sm text-error">{t('disconnected') || 'Failed to connect'}</p>
          )}
        </Card>

        <Card className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-text">{t('addons') || 'Addons'}</h2>

          <div className="space-y-3">
            {installedAddons.map((addon) => (
              <div
                key={addon.transportUrl}
                className="flex items-center justify-between p-4 bg-surface rounded-lg"
              >
                <div>
                  <p className="font-medium text-text">{addon.manifest.name}</p>
                  <p className="text-sm text-text-muted">{addon.transportUrl}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeAddon(addon.transportUrl)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-6 p-6">
          <h2 className="text-lg font-semibold text-text">{t('about') || 'About'}</h2>
          <div className="space-y-2 text-text-muted">
            <p>Kinora v1.0.0</p>
            <p>A Stremio-style streaming client</p>
            <p className="mt-4 text-sm">
              Built with React, TypeScript, Tailwind CSS, and Capacitor
            </p>
            <p className="text-sm">
              Powered by <a href="https://github.com/Stremio" target="_blank" rel="noopener" className="text-primary hover:underline">Stremio</a> core (MIT licensed)
            </p>
            <p className="text-sm">
              Movie data from <a href="https://www.themoviedb.org/" target="_blank" rel="noopener" className="text-primary hover:underline">TMDB</a>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}