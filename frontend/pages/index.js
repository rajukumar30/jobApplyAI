import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../lib/AppContext';

// ── Auth gate ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center shadow-glow mx-auto">
          <span className="text-4xl">🚀</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to JobApply AI</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Automate your job applications with AI-powered resume matching,<br />
            tailoring, and personalized email generation.
          </p>
        </div>
        <button
          onClick={onLogin}
          className="btn-primary w-full py-4 justify-center text-sm"
          id="google-login-btn"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

// ── Individual nav card ────────────────────────────────────────────────────
function NavCard({ icon, title, description, onClick, comingSoon = false, accent = 'brand' }) {
  const accentMap = {
    brand:   'from-brand-600/20 to-brand-800/10 border-brand-500/20 text-brand-400',
    emerald: 'from-emerald-600/20 to-emerald-800/10 border-emerald-500/20 text-emerald-400',
    violet:  'from-violet-600/20 to-violet-800/10 border-violet-500/20 text-violet-400',
    rose:    'from-rose-600/20 to-rose-800/10 border-rose-500/20 text-rose-400',
    amber:   'from-amber-600/20 to-amber-800/10 border-amber-500/20 text-amber-400',
    indigo:  'from-indigo-600/20 to-indigo-800/10 border-indigo-500/20 text-indigo-400',
  };

  return (
    <div
      className={comingSoon ? 'nav-card-coming' : 'nav-card'}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      aria-label={comingSoon ? `${title} (Coming Soon)` : title}
    >
      {comingSoon && (
        <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-white/10">
          Soon
        </div>
      )}
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accentMap[accent]} border flex items-center justify-center mb-4 text-2xl`}>
        {icon}
      </div>
      <h3 className="font-semibold text-white text-base mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>

      {/* Arrow indicator on non-coming-soon cards */}
      {!comingSoon && (
        <div className="absolute bottom-4 right-4 text-slate-600 group-hover:text-brand-400 transition-colors">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── Extension detection ────────────────────────────────────────────────────
function isExtensionInstalled() {
  return !!document.getElementById('jobapply-ext-installed');
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const { user, authLoading, handleLogin, handleLogout, gmailConnected, showToast } = useApp();
  const [extChecking, setExtChecking] = useState(false);

  const handleCommingSoon = () => {
    showToast('info', '🚧 Coming Soon — this feature will be available in a future update!', 3500);
  };

  // Check if extension is installed; if not, route to the install guide page
  const handleAutoDM = useCallback(() => {
    setExtChecking(true);
    let attempts = 0;
    const MAX_ATTEMPTS = 5; // 5 × 300ms = 1.5 seconds

    const interval = setInterval(() => {
      attempts++;
      if (document.getElementById('jobapply-ext-installed')) {
        clearInterval(interval);
        setExtChecking(false);
        router.push('/auto-dm');
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        setExtChecking(false);
        router.push('/auto-dm/install');
      }
    }, 300);
  }, [router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <>
      <Head>
        <title>Dashboard — JobApply AI</title>
        <meta name="description" content="AI-powered job application automation dashboard." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
      </Head>

      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/5 bg-navy-800/60 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center shadow-glow">
                <span className="text-lg">🚀</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient">JobApply AI</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Automated job applications, powered by Gemini</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {user.photoURL && (
                      <img src={user.photoURL} alt={user.displayName} className="w-7 h-7 rounded-full border border-white/10" />
                    )}
                    <span className="text-xs text-slate-400 hidden sm:inline">{user.displayName}</span>
                  </div>
                  <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white transition-colors">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
          {/* Hero */}
          <div className="mb-10 fade-in">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-2">Dashboard</p>
            <h2 className="text-3xl font-bold text-white">What would you like to do?</h2>
            <p className="text-slate-400 text-sm mt-1">Select an action to get started with your job application workflow.</p>
          </div>

          {/* ── Section: Job Automation ──────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-brand-600/20 border border-brand-500/20 flex items-center justify-center">
                <span className="text-base">⚡</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Job Automation</h2>
                <p className="text-xs text-slate-500">AI-powered tools to streamline your applications</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <NavCard
                id="card-apply-jd"
                icon="📋"
                title="Apply with JD / LinkedIn Post"
                description="Paste a job description or LinkedIn URL. AI analyzes the role, matches your best resume, and crafts a personalized email."
                onClick={() => router.push('/apply')}
                accent="brand"
              />
              <NavCard
                icon="💬"
                title="Auto Send DM to HR"
                description="Automatically send personalized direct messages to recruiters on LinkedIn using AI-crafted outreach messages."
                onClick={handleAutoDM}
                accent="violet"
              />
              <NavCard
                icon="🤖"
                title="Auto Apply Easy Apply Jobs"
                description="Automatically detect and apply to LinkedIn Easy Apply jobs that match your profile with one click."
                onClick={handleCommingSoon}
                comingSoon
                accent="rose"
              />
            </div>
          </div>

          {/* ── Section: User ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center">
                <span className="text-base">👤</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">User</h2>
                <p className="text-xs text-slate-500">Manage your resumes, history, and profile</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <NavCard
                icon="📚"
                title="Resume Library"
                description="View, manage, and download all your uploaded and AI-tailored resumes in one place."
                onClick={() => router.push('/library')}
                accent="emerald"
              />
              <NavCard
                icon="🕐"
                title="Application History"
                description="Track all past job applications — company, role, date, and the resume used for each."
                onClick={() => router.push('/history')}
                accent="indigo"
              />
              <NavCard
                icon="⚙️"
                title="User Profile"
                description="View your account details, Gmail SMTP status, and manage your JobApply AI settings."
                onClick={() => router.push('/profile')}
                accent="amber"
              />
            </div>
          </div>
        </main>

        <footer className="border-t border-white/5 py-4 text-center">
          <p className="text-xs text-slate-600">JobApply AI · Powered by Google Gemini · Gmail API</p>
        </footer>
      </div>
    </>
  );
}
