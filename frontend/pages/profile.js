import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';

export default function ProfilePage() {
  const router = useRouter();
  const { user, authLoading, gmailConnected, resumes, handleLogout } = useApp();

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!user) { router.replace('/'); return null; }

  return (
    <PageLayout title="User Profile" showBack backHref="/" backLabel="Dashboard">
      <div className="page-hero">
        <h1>User Profile</h1>
        <p>Your account details and application settings.</p>
      </div>

      <div className="max-w-xl space-y-5">
        {/* Account card */}
        <div className="glass-card p-6 slide-up">
          <div className="panel-header">
            <div className="panel-icon bg-amber-600/20 text-amber-400">
              <span className="text-lg">👤</span>
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Account</h2>
              <p className="text-xs text-slate-400">Signed in via Google</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-16 h-16 rounded-2xl border-2 border-white/10 shadow-lg" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-900/40 border border-brand-500/20 flex items-center justify-center text-3xl">
                {user.displayName?.[0] || '?'}
              </div>
            )}
            <div>
              <p className="text-lg font-bold text-white">{user.displayName}</p>
              <p className="text-sm text-brand-400">{user.email}</p>
              <p className="text-xs text-slate-500 mt-1">UID: {user.uid.slice(0, 16)}…</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-danger w-full justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>

        {/* Stats card */}
        <div className="glass-card p-6 slide-up">
          <div className="panel-header">
            <div className="panel-icon bg-brand-600/20 text-brand-400">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Your Stats</h2>
              <p className="text-xs text-slate-400">Current session overview</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-navy-900/40 border border-white/5">
              <p className="text-2xl font-bold text-brand-400">{resumes.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Resumes in Library</p>
            </div>
            <div className="p-4 rounded-xl bg-navy-900/40 border border-white/5">
              <p className="text-2xl font-bold text-emerald-400">{resumes.filter(r => r.isTailored).length}</p>
              <p className="text-xs text-slate-400 mt-0.5">AI Tailored Resumes</p>
            </div>
          </div>
        </div>

        {/* Gmail SMTP card */}
        <div className="glass-card p-6 slide-up">
          <div className="panel-header">
            <div className="panel-icon bg-rose-600/20 text-rose-400">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-white text-base">Gmail SMTP</h2>
              <p className="text-xs text-slate-400">Used to send application emails</p>
            </div>
            {gmailConnected ? (
              <span className="badge-green flex items-center gap-1.5 text-xs">
                <span className="status-dot bg-emerald-400 animate-pulse" />Ready
              </span>
            ) : (
              <span className="badge-red flex items-center gap-1.5 text-xs">
                <span className="status-dot bg-red-400" />Not Set
              </span>
            )}
          </div>

          {!gmailConnected && (
            <div className="bg-navy-900/60 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-1.5">
              <p className="text-slate-400 font-sans text-xs mb-2 non-mono">Add to your <code className="bg-navy-900/60 px-1.5 py-0.5 rounded text-brand-400">.env</code> file and restart the backend:</p>
              <p><span className="text-brand-400">GMAIL_USER</span>=you@gmail.com</p>
              <p><span className="text-brand-400">GMAIL_APP_PASSWORD</span>=xxxx xxxx xxxx xxxx</p>
            </div>
          )}
        </div>

        {/* App info */}
        <div className="glass-card p-5 slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-blue-800 flex items-center justify-center">
              <span>🚀</span>
            </div>
            <div>
              <p className="font-semibold text-white text-sm">JobApply AI</p>
              <p className="text-xs text-slate-500">v2 · Multi-page workflow edition</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Powered by Google Gemini for job analysis, resume tailoring, and email generation.
            Application history is tracked in Firebase Firestore.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}
