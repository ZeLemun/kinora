import { Routes, Route, Outlet, Link, useLocation } from 'react-router-dom';
import { TranslationProvider, useTranslation } from './hooks/useTranslation';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { BrowsePage } from './pages/BrowsePage';
import { LibraryPage } from './pages/LibraryPage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AddonsPage } from './pages/AddonsPage';
import { cn } from './utils/cn';
import { useAppStore } from './store/app-store';
import { useEffect } from 'react';
import { AddonBootstrap } from './components/AddonBootstrap';
import { useIsLandscape, useKeyboardOpen } from './hooks/useViewport';

interface TabConfig {
  path: string;
  /** i18n key, so the nav follows the selected language. */
  label: 'home' | 'search' | 'library' | 'settings';
  icon: React.FC<{ className?: string }>;
}

const tabs: TabConfig[] = [
  { path: '/', label: 'home', icon: HomeIcon },
  { path: '/search', label: 'search', icon: SearchIcon },
  { path: '/library', label: 'library', icon: LibraryIcon },
  { path: '/settings', label: 'settings', icon: SettingsIcon },
];

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const isLandscape = useIsLandscape();
  const keyboardOpen = useKeyboardOpen();

  // In landscape the soft keyboard eats the bottom of the screen, so the bar
  // would sit on top of whatever is being typed. Hide it for that case only.
  const hidden = isLandscape && keyboardOpen;

  return (
    <nav
      aria-hidden={hidden}
      className={cn(
        'safe-bottom z-50 flex-none overflow-hidden border-t border-white/5 bg-background/95 backdrop-blur-md transition-[max-height,opacity] duration-200',
        hidden ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100'
      )}
    >
      {/* Full width in landscape so there are no dead bars beside the nav. */}
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-around px-2 py-1.5 [@media(orientation:landscape)]:max-w-none">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              aria-label={t(tab.label)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                // Fixed height + flex-col keeps every label on the same baseline.
                'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors',
                isActive ? 'bg-primary/20 text-primary' : 'text-text-muted'
              )}
            >
              <tab.icon className="h-[22px] w-[22px]" />
              <span className="truncate text-[10px] leading-none font-medium">{t(tab.label)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Layout() {
  return (
    // App-shell: the nav is a flex sibling of the scroll area, so it can never
    // be scrolled out of view the way a `fixed` element can inside a WebView.
    <div className="safe-area flex h-[100dvh] flex-col overflow-hidden bg-background">
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="browse/:type/:catalog" element={<BrowsePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="addons" element={<AddonsPage />} />
        <Route path=":type/:id" element={<DetailPage />} />
        <Route path="watch/:type/:id" element={<DetailPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  const { theme, setTheme } = useAppStore();

  useEffect(() => {
    setTheme(theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, setTheme]);

  return (
    <TranslationProvider>
      <AddonBootstrap />
      <AppRoutes />
    </TranslationProvider>
  );
}

export default App;
