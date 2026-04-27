import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';
import ApplicationHistoryPanel from '../components/ApplicationHistoryPanel';

export default function HistoryPage() {
  const router = useRouter();
  const { user, authLoading, historyRefreshTrigger } = useApp();

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
    <PageLayout title="Application History" showBack backHref="/" backLabel="Dashboard">
      <div className="page-hero">
        <h1>Application History</h1>
        <p>All past job applications tracked by JobApply AI.</p>
      </div>

      <div className="max-w-2xl">
        <ApplicationHistoryPanel refreshTrigger={historyRefreshTrigger} />
      </div>
    </PageLayout>
  );
}
