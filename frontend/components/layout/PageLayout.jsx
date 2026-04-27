import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApp } from '../../lib/AppContext';

export default function PageLayout({ children, title, subtitle, showBack = true, backHref = '/', backLabel = 'Dashboard' }) {
  const router = useRouter();
  const { user, gmailConnected, handleLogout } = useApp();

  return (
    <>
      <Head>
        <title>{title} — JobApply AI</title>
        <meta name="description" content={subtitle || 'AI-powered job application automation'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
      </Head>

      <div className="min-h-screen flex flex-col">
        {/* ── Sticky Header ─────────────────────────────────────────────── */}
        <header className="border-b border-white/5 bg-navy-800/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
            {/* Back button */}
            {showBack && (
              <button
                onClick={() => router.push(backHref)}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm group"
                aria-label={`Back to ${backLabel}`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">{backLabel}</span>
              </button>
            )}

            {/* Logo */}
            {!showBack && (
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center shadow-glow">
                  <span className="text-lg">🚀</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gradient">JobApply AI</h1>
                  <p className="text-xs text-slate-500 hidden sm:block">Automated job applications, powered by Gemini</p>
                </div>
              </Link>
            )}

            {showBack && (
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center">
                  <span className="text-sm">🚀</span>
                </div>
                <span className="font-bold text-gradient text-base">JobApply AI</span>
              </div>
            )}

            {/* Page title (center-ish) */}
            <div className="flex-1 min-w-0">
              {title && (
                <p className="text-sm font-semibold text-white truncate ml-2">{title}</p>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {gmailConnected ? (
                <span className="badge-green flex items-center gap-1.5 text-xs">
                  <span className="status-dot bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Gmail SMTP Ready</span>
                </span>
              ) : (
                <span className="badge-red flex items-center gap-1.5 text-xs">
                  <span className="status-dot bg-red-400" />
                  <span className="hidden sm:inline">SMTP Not Set</span>
                </span>
              )}
              {user && (
                <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white transition-colors">
                  Logout
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ───────────────────────────────────────────────── */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          {subtitle && (
            <div className="mb-8">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold text-brand-400">{subtitle}</p>
            </div>
          )}
          {children}
        </main>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-4 text-center">
          <p className="text-xs text-slate-600">
            JobApply AI · Powered by Google Gemini · Gmail API
          </p>
        </footer>
      </div>
    </>
  );
}
