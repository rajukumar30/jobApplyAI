import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';
import PageLayout from '../../components/layout/PageLayout';

// ── Extension installed check ────────────────────────────────────────────────
function isExtensionInstalled() {
  return !!document.getElementById('jobapply-ext-installed');
}

// ── Step component ───────────────────────────────────────────────────────────
function Step({ number, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
        <span className="text-sm font-bold text-violet-400">{number}</span>
      </div>
      <div className="pt-1">
        <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
        <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function InstallPage() {
  const router = useRouter();
  const [detected, setDetected] = useState(false);
  const [checking, setChecking] = useState(false);

  // Poll every 1.5 s in case the user installs while the page is open
  useEffect(() => {
    if (isExtensionInstalled()) {
      setDetected(true);
      return;
    }
    const interval = setInterval(() => {
      if (isExtensionInstalled()) {
        setDetected(true);
        clearInterval(interval);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleRetry = useCallback(() => {
    setChecking(true);
    setTimeout(() => {
      if (isExtensionInstalled()) {
        router.push('/auto-dm');
      } else {
        setChecking(false);
      }
    }, 400);
  }, [router]);

  // Auto-redirect once detected while on this page
  useEffect(() => {
    if (detected) {
      const t = setTimeout(() => router.push('/auto-dm'), 1500);
      return () => clearTimeout(t);
    }
  }, [detected, router]);

  return (
    <PageLayout>
      <Head>
        <title>Install Extension — JobApply AI</title>
      </Head>

      <div className="max-w-2xl mx-auto py-8">

        {/* ── Detected banner ── */}
        {detected && (
          <div className="mb-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-5 py-4 rounded-xl animate-pulse">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-semibold text-sm">Extension detected!</p>
              <p className="text-xs opacity-80">Redirecting you to the Auto-DM dashboard…</p>
            </div>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-violet-900/20 border border-violet-500/30 flex items-center justify-center text-3xl shadow-lg">
            🧩
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Install the JobApply Extension</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              The Chrome Extension is required to extract your LinkedIn connections.
            </p>
          </div>
        </div>

        {/* ── Why needed ── */}
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl px-5 py-4 mb-8 text-sm text-slate-300 leading-relaxed">
          <span className="font-semibold text-violet-300">Why is the extension required?</span>
          <br />
          LinkedIn's connections page runs inside the browser and cannot be accessed directly by a web app. The JobApply Chrome Extension securely navigates your connections list, extracts recruiter profiles, and syncs them to your dashboard — all in one click.
        </div>

        {/* ── Install steps ── */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 mb-8 space-y-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">How to install</h2>

          <Step number="1" title="Download the extension files">
            The extension is not yet on the Chrome Web Store. Download the latest ZIP from GitHub or ask your admin for the <code className="bg-slate-900 px-1.5 py-0.5 rounded text-violet-300 text-xs">extension/</code> folder.
          </Step>

          <Step number="2" title="Open Chrome Extensions settings">
            In Chrome, go to{' '}
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-violet-300 text-xs">chrome://extensions</code>
            {' '}and enable <strong className="text-white">Developer Mode</strong> (toggle in top-right corner).
          </Step>

          <Step number="3" title='Click "Load unpacked"'>
            Click the <strong className="text-white">Load unpacked</strong> button, then select the{' '}
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-violet-300 text-xs">extension/</code>{' '}
            folder from the JobApply AI project.
          </Step>

          <Step number="4" title="Pin the extension (optional but recommended)">
            Click the 🧩 puzzle icon in the Chrome toolbar, find <strong className="text-white">JobApply Connections Extractor</strong>, and click the 📌 pin icon so it's always visible.
          </Step>

          <Step number="5" title="Come back here and click Retry">
            Once installed, this page will automatically detect the extension. If not, click <strong className="text-white">Check Again</strong> below.
          </Step>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            disabled={checking || detected}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm transition-all bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {checking ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Checking…
              </span>
            ) : detected ? '✅ Detected! Redirecting…' : '🔍 Check Again'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 px-6 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* ── Help note ── */}
        <p className="text-center text-xs text-slate-600 mt-6">
          After installing, refresh this page or click &quot;Check Again&quot; — you will be redirected automatically.
        </p>
      </div>
    </PageLayout>
  );
}
