import { useRouter } from 'next/router';
import PageLayout from '../components/layout/PageLayout';
import JobAnalysisPanel from '../components/JobAnalysisPanel';
import BestResumePanel from '../components/BestResumePanel';
import { buildAuthenticatedUrl } from '../lib/authenticatedAxios';
import { useApp } from '../lib/AppContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function ScoreBar({ score, label }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const textColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div>
      {label && <p className="text-xs text-slate-500 mb-1">{label}</p>}
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-slate-400">ATS Match</span>
        <span className={`text-sm font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="h-1.5 bg-navy-900/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function TailorResultsPage() {
  const router = useRouter();
  const { user, authLoading, tailorJobResult, tailorMatchResult } = useApp();

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

  if (!user) {
    router.replace('/');
    return null;
  }

  if (!tailorJobResult || !tailorMatchResult) {
    router.replace('/tailor');
    return null;
  }

  const jobResult = tailorJobResult;
  const matchResult = tailorMatchResult;
  const rankings = matchResult.rankings || [];
  const bestIdx = matchResult.bestMatchIndex ?? 0;
  const tailored = matchResult.tailoringPerformed;
  const tailoredResume = tailored ? matchResult.bestResume : null;
  const atsReport = matchResult.atsReport;

  const handleDownloadTailored = async () => {
    if (!tailoredResume?.filename) return;
    const url = `${API}/resumes/download/${encodeURIComponent(tailoredResume.filename)}?isTailored=true`;
    const authenticatedUrl = await buildAuthenticatedUrl(url);
    window.open(authenticatedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <PageLayout title="Tailor Results" showBack backHref="/tailor" backLabel="Tailor Again">
      <div className="page-hero">
        <h1>Tailored Resume Results</h1>
        <p>ATS scores for every resume · AI-optimized version ready to download</p>
      </div>

      {tailored && tailoredResume && (
        <div className="glass-card p-6 mb-6 border border-brand-500/30 bg-brand-900/10 slide-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-brand-300 font-semibold text-lg mb-1">✨ Your tailored resume is ready</p>
              <p className="text-slate-400 text-sm">
                {tailoredResume.originalName || tailoredResume.parsedData?.name}
                {matchResult.originalMatchPercentage != null && matchResult.tailoredMatchPercentage != null && (
                  <span className="ml-2 text-brand-400">
                    {matchResult.originalMatchPercentage}% → {matchResult.tailoredMatchPercentage}% ATS match
                  </span>
                )}
              </p>
            </div>
            <button onClick={handleDownloadTailored} className="btn-primary px-8 py-3 flex-shrink-0">
              ⬇ Download Tailored PDF
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-3">
          <JobAnalysisPanel jobData={jobResult} loading={false} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6 slide-up">
            <div className="panel-header mb-4">
              <div className="panel-icon bg-violet-600/20 text-violet-400">
                <span className="text-lg">📊</span>
              </div>
              <div>
                <h2 className="font-semibold text-white text-base">ATS Scores — All Resumes</h2>
                <p className="text-xs text-slate-400">How each resume matches this job</p>
              </div>
            </div>

            <div className="space-y-4">
              {rankings.map((ranking, i) => {
                const resume = ranking.resume;
                const isBest = ranking.index === bestIdx;
                const displayScore = isBest && tailored && matchResult.tailoredMatchPercentage != null
                  ? matchResult.tailoredMatchPercentage
                  : ranking.score;
                const showOptimized = isBest && tailored && matchResult.tailoredMatchPercentage != null;

                return (
                  <div
                    key={i}
                    className={`p-4 rounded-xl border ${
                      isBest ? 'bg-violet-900/10 border-violet-500/30' : 'bg-navy-900/30 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold ${isBest ? 'text-violet-400' : 'text-slate-500'}`}>
                        #{i + 1}
                      </span>
                      <p className="text-sm font-medium text-white truncate flex-1">
                        {resume?.parsedData?.name || resume?.originalName}
                      </p>
                      {isBest && <span className="badge bg-violet-900/40 text-violet-300 text-[10px]">Best</span>}
                      {showOptimized && <span className="badge bg-brand-900/40 text-brand-300 text-[10px]">Optimized</span>}
                    </div>

                    {showOptimized ? (
                      <div className="space-y-2">
                        <ScoreBar score={ranking.score} label="Before tailoring" />
                        <ScoreBar score={matchResult.tailoredMatchPercentage} label="After tailoring" />
                      </div>
                    ) : (
                      <ScoreBar score={displayScore} />
                    )}

                    {ranking.reason && (
                      <p className="text-xs text-slate-500 mt-2 leading-relaxed">{ranking.reason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <BestResumePanel matchResult={matchResult} loading={false} />
        </div>
      </div>

      {atsReport && (atsReport.missingKeywordsInjected?.length > 0 || atsReport.missingKeywords?.length > 0) && (
        <div className="glass-card p-6 mb-8 slide-up">
          <h3 className="text-sm font-bold text-white mb-4">ATS Keyword Optimization</h3>
          {atsReport.missingKeywordsInjected?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-emerald-400 font-medium mb-2">Keywords added to your resume</p>
              <div className="flex flex-wrap gap-1.5">
                {atsReport.missingKeywordsInjected.map((kw, i) => (
                  <span key={i} className="badge-green text-xs">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {atsReport.missingKeywords?.length > 0 && (
            <div>
              <p className="text-xs text-amber-400 font-medium mb-2">Keywords still missing from resume</p>
              <div className="flex flex-wrap gap-1.5">
                {atsReport.missingKeywords.map((kw, i) => (
                  <span key={i} className="badge bg-amber-900/30 text-amber-300 border border-amber-500/20 text-xs">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-white/5">
        <button onClick={() => router.push('/tailor')} className="btn-secondary">
          ← Tailor Another JD
        </button>
        <button onClick={() => router.push('/library')} className="btn-primary px-8">
          View Resume Library →
        </button>
      </div>
    </PageLayout>
  );
}
