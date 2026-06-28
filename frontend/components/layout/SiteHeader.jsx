import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApp } from '../../lib/AppContext';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard', icon: '🏠', exact: true },
  { href: '/apply', label: 'Apply', icon: '📋' },
  { href: '/tailor', label: 'Tailor', icon: '✨' },
  { href: '/library', label: 'Library', icon: '📚' },
  { href: '/history', label: 'History', icon: '🕐' },
  { href: '/profile', label: 'Profile', icon: '⚙️' },
];

function GmailBadge({ connected, compact = false }) {
  if (connected) {
    return (
      <span className="badge-green flex items-center gap-1.5 text-[11px] sm:text-xs shrink-0" title="Gmail connected">
        <span className="status-dot bg-emerald-400 animate-pulse" />
        {!compact && <span className="hidden md:inline">Gmail Ready</span>}
      </span>
    );
  }
  return (
    <span className="badge-red flex items-center gap-1.5 text-[11px] sm:text-xs shrink-0" title="Gmail not connected">
      <span className="status-dot bg-red-400" />
      {!compact && <span className="hidden md:inline">Gmail Off</span>}
    </span>
  );
}

function Logo({ compact = false }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0 shrink-0">
      <div
        className={`rounded-xl bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center shadow-glow transition-transform group-hover:scale-105 ${
          compact ? 'w-8 h-8' : 'w-9 h-9'
        }`}
      >
        <span className={compact ? 'text-base' : 'text-lg'}>🚀</span>
      </div>
      <div className="min-w-0">
        <h1 className={`font-bold text-gradient leading-tight ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
          JobApply AI
        </h1>
        {!compact && (
          <p className="text-[10px] sm:text-xs text-slate-500 truncate hidden sm:block">
            AI-powered job applications
          </p>
        )}
      </div>
    </Link>
  );
}

export default function SiteHeader({
  title,
  showBack = false,
  backHref = '/',
  backLabel = 'Dashboard',
}) {
  const router = useRouter();
  const { user, gmailConnected, handleLogout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [router.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (href, exact) => {
    if (exact) return router.pathname === href;
    return router.pathname === href || router.pathname.startsWith(`${href}/`);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-900/80 backdrop-blur-xl safe-top">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4 h-14 sm:h-16">
            {/* Back (inner pages) */}
            {showBack && (
              <button
                type="button"
                onClick={() => router.push(backHref)}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs sm:text-sm group shrink-0 -ml-1 px-1"
                aria-label={`Back to ${backLabel}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 transition-transform group-hover:-translate-x-0.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline max-w-[5rem] md:max-w-none truncate">{backLabel}</span>
              </button>
            )}

            {/* Logo — compact when back button shown */}
            {showBack ? (
              <Link href="/" className="flex items-center gap-2 shrink-0 min-w-0 sm:hidden">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center">
                  <span className="text-sm">🚀</span>
                </div>
              </Link>
            ) : (
              <Logo />
            )}

            {showBack && (
              <div className="hidden sm:flex items-center shrink-0">
                <Logo compact />
              </div>
            )}

            {/* Page title */}
            {title && (
              <div className="flex-1 min-w-0 hidden md:block">
                <p className="text-sm font-medium text-slate-300 truncate pl-1 border-l border-white/10 ml-1">
                  {title}
                </p>
              </div>
            )}

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main">
              {NAV_LINKS.map(({ href, label, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive(href, exact)
                      ? 'text-white bg-brand-600/20 border border-brand-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
              <GmailBadge connected={gmailConnected} />

              {user && (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-7 h-7 rounded-full border border-white/10 object-cover"
                    />
                  )}
                  <span className="text-xs text-slate-400 max-w-[6rem] truncate hidden md:inline">
                    {user.displayName}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-xs text-slate-500 hover:text-white transition-colors px-1"
                  >
                    Logout
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg border border-white/10 bg-navy-800/60 text-slate-300 hover:text-white hover:border-white/20 transition-colors"
                aria-expanded={menuOpen}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                {menuOpen ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile page title */}
          {title && (
            <p className="md:hidden text-xs font-medium text-slate-400 truncate pb-2.5 -mt-1">
              {title}
            </p>
          )}
        </div>
      </header>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            onClick={closeMenu}
            aria-label="Close menu"
          />
          <div className="absolute top-0 right-0 h-full w-[min(100%,20rem)] bg-navy-900 border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right safe-top safe-bottom">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={closeMenu}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {user && (
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                {user.photoURL && (
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <GmailBadge connected={gmailConnected} compact />
              </div>
            )}

            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Mobile">
              {NAV_LINKS.map(({ href, label, icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(href, exact)
                      ? 'text-white bg-brand-600/20 border border-brand-500/30'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-lg w-6 text-center">{icon}</span>
                  {label}
                </Link>
              ))}
            </nav>

            {user && (
              <div className="p-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    handleLogout();
                  }}
                  className="w-full btn-secondary justify-center text-sm py-3"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
