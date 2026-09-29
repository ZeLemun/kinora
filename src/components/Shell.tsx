import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

type Icon = (p: { className?: string }) => React.ReactElement;

const HomeIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
  </svg>
);

const CompassIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z" />
  </svg>
);

const SearchIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const LibraryIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const HeartIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const BookmarkIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
  </svg>
);

const SettingsIcon: Icon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Navigation model                                                   */
/* ------------------------------------------------------------------ */

interface NavItem {
  to: string;
  label: string;
  icon: Icon;
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/discover', label: 'Discover', icon: CompassIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
];

const SECONDARY: NavItem[] = [
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/favorites', label: 'Favorites', icon: HeartIcon },
  { to: '/watchlist', label: 'Watchlist', icon: BookmarkIcon },
];

/**
 * Mobile keeps four items; everything else lives behind the "More" sheet.
 *
 * Picked by path rather than by index. `PRIMARY[2]` used to be Sports, so
 * deleting that entry would have quietly turned the third tab into Movies
 * with no error anywhere.
 */
const MOBILE_PATHS = ['/', '/discover', '/search', '/library'];
const MOBILE_PRIMARY: NavItem[] = [...PRIMARY, ...SECONDARY].filter((i) =>
  MOBILE_PATHS.includes(i.to)
);

const MORE_ITEMS: NavItem[] = [
  { to: '/watchlist', label: 'Watchlist', icon: BookmarkIcon },
  { to: '/favorites', label: 'Favorites', icon: HeartIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'safe-left safe-top safe-bottom sticky top-0 z-40 hidden shrink-0 flex-col border-r border-line bg-background/85 backdrop-blur-xl transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[72px]' : 'w-[250px]'
      )}
    >
      <Link to="/" className="flex h-16 flex-none items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--color-accent)] text-sm font-black text-white">
          K
        </span>
        {!collapsed && <span className="text-lg font-bold tracking-tight text-text">Kinora</span>}
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Main">
        {[...PRIMARY, ...SECONDARY].map((item) => (
          <SideLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex-none space-y-1 border-t border-line p-3">
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-text-muted transition-colors hover:bg-elevated hover:text-text"
        >
          <Chevron dir={collapsed ? 'right' : 'left'} className="h-4 w-4 flex-none" />
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>

        <NavLink
          to="/settings"
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-elevated"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-elevated text-sm font-semibold text-text">
            E
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">Ercin</span>
              <span className="block truncate text-xs text-text-muted">Settings</span>
            </span>
          )}
        </NavLink>
      </div>
    </aside>
  );
}

function Chevron({ dir, className }: { dir: 'left' | 'right'; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: dir === 'left' ? 'rotate(180deg)' : undefined }}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SideLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-elevated text-text' : 'text-text-muted hover:bg-elevated/60 hover:text-text'
        )
      }
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 h-5 w-[3px] rounded-r-full bg-[var(--color-accent)] transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0'
            )}
          />
          <item.icon className="h-5 w-5 flex-none" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

/* ------------------------------------------------------------------ */
/*  Bottom navigation (mobile)                                         */
/* ------------------------------------------------------------------ */

export function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        className="safe-bottom z-50 flex-none border-t border-line bg-background/95 backdrop-blur-xl lg:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1.5 py-1.5 [@media(orientation:landscape)]:max-w-none">
          {MOBILE_PRIMARY.map((item) => {
            const active =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors',
                  active ? 'bg-elevated text-text' : 'text-text-muted'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation"
            className="flex h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium text-text-muted transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM18 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" />
            </svg>
            <span>More</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] lg:hidden">
      <div className="fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="pop-in absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface p-4 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-elevated" aria-hidden />
        <div className="grid grid-cols-4 gap-3">
          {MORE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className="flex flex-col items-center gap-2 rounded-xl bg-card px-2 py-3 text-[11px] font-medium text-text"
            >
              <item.icon className="h-6 w-6" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
