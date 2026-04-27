import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';
import JobAnalysisPanel from '../components/JobAnalysisPanel';
import BestResumePanel from '../components/BestResumePanel';

// Step flow indicator (shared pattern)
function StepFlow({ current }) {
  const steps = ['Apply', 'Analysis', 'Email'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const isDone = idx < current;
        const isActive = idx === current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={isActive ? 'step-dot-active' : isDone ? 'step-dot-done' : 'step-dot-idle'}>
                {isDone ? '✓' : idx}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px ${isDone ? 'bg-gradient-to-r from-emerald-500/40 to-brand-500/40' : 'bg-white/5'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}


export default function AnalysisPage() {
  const router = useRouter();
  const {
    user, authLoading,
    jobResult, matchResult, fakeJobResult, duplicateWarning,
    pipelineSteps,
  } = useApp();
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <svg className="w-8 h-8 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );

  if (!user) { router.replace('/'); return null; }
  if (!jobResult) { router.replace('/apply'); return null; }

  return (
    <PageLayout title="Job Analysis" showBack backHref="/apply" backLabel="Apply">
      <StepFlow current={2} />

      {/* Hero */}
      <div className="page-hero">
        <h1>Job Analysis Results</h1>
        <p>AI-extracted job details · Best matching resume with ATS score</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left — Job Analysis (wider) */}
        <div className="lg:col-span-3">
          <JobAnalysisPanel
            jobData={jobResult}
            fakeJobResult={fakeJobResult}
            loading={false}
            duplicateWarning={duplicateWarning}
            steps={pipelineSteps}
          />
        </div>

        {/* Right — Best Resume */}
        <div className="lg:col-span-2">
          <BestResumePanel
            matchResult={matchResult}
            loading={false}
            steps={pipelineSteps}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between pt-6 border-t border-white/5">
        <button
          onClick={() => router.push('/apply')}
          className="btn-secondary"
        >
          ← Back to Apply
        </button>
        <button
          onClick={() => router.push('/email')}
          disabled={!matchResult && !jobResult}
          className="btn-primary px-8"
          id="proceed-email-btn"
        >
          Proceed to Send Email →
        </button>
      </div>
    </PageLayout>
  );
}
