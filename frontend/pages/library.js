import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';
import ResumeLibrary from '../components/ResumeLibrary';
import ResumeUploadPanel from '../components/ResumeUploadPanel';

export default function LibraryPage() {
  const router = useRouter();
  const { user, authLoading, resumes, resumes_loading, handleResumeUploaded, handleResumeDeleted } = useApp();

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
    <PageLayout title="Resume Library" showBack backHref="/" backLabel="Dashboard">
      <div className="page-hero">
        <h1>Resume Library</h1>
        <p>Manage all your uploaded and AI-tailored resumes in one place.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {!resumes_loading ? (
            <ResumeLibrary resumes={resumes} onDeleted={handleResumeDeleted} />
          ) : (
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton w-9 h-9 rounded-xl" />
                <div className="skeleton h-5 w-40 rounded-lg" />
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            </div>
          )}
        </div>
        <div>
          <ResumeUploadPanel onUploaded={handleResumeUploaded} />
        </div>
      </div>
    </PageLayout>
  );
}
