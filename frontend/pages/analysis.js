import { useRouter } from 'next/router';
import { useApp } from '../lib/AppContext';
import PageLayout from '../components/layout/PageLayout';
import StepFlow from '../components/layout/StepFlow';
import JobAnalysisPanel from '../components/JobAnalysisPanel';
import BestResumePanel from '../components/BestResumePanel';

// Score bar
function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">Match Score</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-1.5 bg-navy-900/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function AnalysisPage() {
  const router = useRouter();
  const {
    user, authLoading,
    jobResult, matchResult, duplicateWarning,
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

  const rankings = matchResult?.rankings || [];
  const bestIdx = matchResult?.bestMatchIndex ?? 0;

  return (
    <PageLayout title="Job Analysis" showBack backHref="/apply" backLabel="Apply">
      <StepFlow current={2} />

      {/* Hero */}
      <div className="page-hero">
        <h1>Job Analysis Results</h1>
        <p>AI-extracted job details on the left · Resume match rankings on the right</p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        {/* Left — Job Analysis (wider) */}
        <div className="lg:col-span-3">
          <JobAnalysisPanel
            jobData={jobResult}
            loading={false}
            duplicateWarning={duplicateWarning}
            steps={pipelineSteps}
          />
        </div>

        {/* Right — Resume Rankings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Rankings card */}
          <div className="glass-card p-6 slide-up">
            <div className="panel-header">
              <div className="panel-icon bg-emerald-600/20 text-emerald-400">
                <span className="text-lg">🏆</span>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-white text-base">Resume Rankings</h2>
                <p className="text-xs text-slate-400">AI-scored against job requirements</p>
              </div>
            </div>

            {rankings.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm">No resumes matched</p>
                <p className="text-slate-500 text-xs mt-1">Upload resumes on the Apply page</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankings.map((ranking, i) => {
                  const resume = ranking.resume;
                  const isWinner = ranking.index === bestIdx;
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border transition-all duration-200 ${
                        isWinner ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-navy-900/30 border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold w-5 text-center ${isWinner ? 'text-emerald-400' : 'text-slate-500'}`}>
                          #{i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-100 truncate">
                            {resume?.parsedData?.name || resume?.originalName || `Resume ${ranking.index + 1}`}
                          </p>
                          {resume?.parsedData?.idealRole && (
                            <p className="text-xs text-slate-500 truncate">{resume.parsedData.idealRole}</p>
                          )}
                        </div>
                        {isWinner && <span className="badge-green text-[10px]">Best</span>}
                      </div>
                      <ScoreBar score={ranking.score} />
                      {ranking.reason && (
                        <p className="text-xs text-slate-500 mt-2 pl-5 leading-relaxed">{ranking.reason}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Best Resume highlight */}
          <BestResumePanel
            matchResult={matchResult}
            loading={false}
            steps={pipelineSteps}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-6 border-t border-white/5">
        <button
          onClick={() => router.push('/apply')}
          className="btn-secondary justify-center sm:justify-start"
        >
          ← Back to Apply
        </button>
        <button
          onClick={() => router.push('/email')}
          disabled={!matchResult && !jobResult}
          className="btn-primary px-6 sm:px-8 justify-center"
          id="proceed-email-btn"
        >
          Proceed to Send Email →
        </button>
      </div>
    </PageLayout>
  );
}
