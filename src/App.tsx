import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Sidebar, BottomNav } from './components/Shell';
import { MiniPlayer } from './components/MiniPlayer';
import { ToastProvider } from './components/ui';
import { PlayerProvider } from './hooks/usePlayer';
import { useAppStore, selectTheme } from './store/app-store';
import { useIsLandscape, useKeyboardOpen } from './hooks/useViewport';
import { HomePage } from './pages/HomePage';
import { DiscoverPage } from './pages/DiscoverPage';
import { CatalogPage } from './pages/CatalogPage';
import { SearchPage } from './pages/SearchPage';
import { LibraryPage } from './pages/LibraryPage';
import { DetailPage } from './pages/DetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { SportsPage } from './pages/SportsPage';
import { PlayerPage } from './pages/PlayerPage';

/**
 * App shell.
 *
 * The player is a route that fills the whole viewport, so the sidebar and nav
 * are hidden while it is mounted — a video with a sidebar beside it defeats the
 * point, and by then the native plugin has already hidden the system bars.
 */
function Shell() {
  const location = useLocation();
  const isPlayer = location.pathname.startsWith('/player/');
  const isLandscape = useIsLandscape();
  const keyboardOpen = useKeyboardOpen();
  const theme = useAppStore(selectTheme);

  // In landscape the soft keyboard eats the bottom of the screen, so the nav
  // would sit on top of whatever is being typed. Hide it for that case only.
  const navHidden = isLandscape && keyboardOpen;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // A client-side route change does not reset scroll, so do it here.
  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {!isPlayer ? <Sidebar /> : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {!isPlayer ? <TopBar /> : null}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/movies" element={<CatalogPage type="movie" />} />
            <Route path="/series" element={<CatalogPage type="series" />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/watchlist" element={<LibraryPage initialTab="watchlist" />} />
            <Route path="/favorites" element={<LibraryPage initialTab="favorites" />} />
            <Route path="/sports" element={<SportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/movie/:id" element={<DetailPage type="movie" />} />
            <Route path="/series/:id" element={<DetailPage type="series" />} />
            <Route path="/player/:id" element={<PlayerPage />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </main>

        {!isPlayer && !navHidden ? <BottomNav /> : null}
        <MiniPlayer />
      </div>
    </div>
  );
}

/** Compact header for narrow screens; the sidebar is desktop-only. */
function TopBar() {
  return (
    <header className="safe-top sticky top-0 z-40 flex h-14 flex-none items-center gap-3 border-b border-line bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[var(--color-accent)] text-xs font-black text-white">
        K
      </span>
      <span className="flex-1 truncate text-base font-bold tracking-tight text-text">Kinora</span>
    </header>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PlayerProvider>
        <Shell />
      </PlayerProvider>
    </ToastProvider>
  );
}
