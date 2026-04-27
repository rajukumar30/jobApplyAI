import { StepRow } from './AIPipelineProgress';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function BestResumePanel({ matchResult, loading, steps = [] }) {
  if (loading) {
    const relevantSteps = steps.filter(s => ['match_resume', 'score', 'tailor', 'compile_pdf', 'upload'].includes(s.id));
    return (
      <div className="glass-card p-6">
        <div className="panel-header mb-4">
          <div className="panel-icon bg-emerald-600/20 text-emerald-400"><span className="text-lg">🏆</span></div>
          <div>
            <h2 className="font-semibold text-white text-base">Best Matching Resume</h2>
            <p className="text-xs text-slate-400">AI-selected based on job requirements</p>
          </div>
        </div>
        {relevantSteps.length > 0 ? (
          <div className="space-y-2">
            {relevantSteps.map((step, i) => (
              <StepRow key={i} step={step} index={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[90, 70, 80].map((w, i) => (
              <div key={i} className="skeleton h-5 rounded-lg" style={{ width: `${w}%` }} />
            ))}
            <div className="skeleton h-20 rounded-xl mt-4" />
          </div>
        )}
      </div>
    );
  }

  if (!matchResult) {
    return (
      <div className="glass-card p-6">
        <div className="panel-header">
          <div className="panel-icon bg-emerald-600/20 text-emerald-400"><span className="text-lg">🏆</span></div>
          <div>
            <h2 className="font-semibold text-white text-base">Best Matching Resume</h2>
            <p className="text-xs text-slate-400">AI-selected based on job requirements</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-900/20 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏆</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">No match result yet</p>
          <p className="text-slate-500 text-xs mt-1">Analyze a job and upload resumes to see the best match</p>
        </div>
      </div>
    );
  }

  const best = matchResult.bestResume;
  const p = best?.parsedData || {};
  const rankings = matchResult.rankings || [];
  const bestRanking = rankings.find(r => r.index === matchResult.bestMatchIndex);
  const bestScore = bestRanking?.score;
  const displayScore = matchResult.tailoringPerformed && matchResult.tailoredMatchPercentage 
    ? matchResult.tailoredMatchPercentage 
    : bestScore;

  const relevantSteps = steps.filter(s => ['match_resume', 'score', 'tailor', 'compile_pdf', 'upload'].includes(s.id));

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-emerald-600/20 text-emerald-400"><span className="text-lg">🏆</span></div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">Best Matching Resume</h2>
          <p className="text-xs text-slate-400">AI-selected based on job requirements</p>
        </div>
        {displayScore !== undefined && (
          <div className="text-right">
            <p className={`text-2xl font-bold ${displayScore >= 80 ? 'text-brand-400' : displayScore >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {displayScore}%
            </p>
            <p className="text-xs text-slate-500">{matchResult.tailoringPerformed ? 'optimized score' : 'match score'}</p>
          </div>
        )}
      </div>

      {/* Tailoring Status */}
      {matchResult.tailoringPerformed !== undefined && (
        matchResult.tailoringPerformed ? (
          <div className="mb-5 p-4 rounded-xl border border-brand-500/40 bg-brand-900/20 fade-in">
            <p className="text-brand-300 font-semibold text-sm mb-1">✨ AI optimized your resume to improve job match.</p>
            <div className="flex gap-4 mt-2">
              <div>
                <p className="text-xs text-slate-400">Original Match</p>
                <p className="text-sm font-bold text-slate-300">{matchResult.originalMatchPercentage}%</p>
              </div>
              <div>
                <p className="text-xs text-brand-400">Tailored Match</p>
                <p className="text-sm font-bold text-brand-300">{matchResult.tailoredMatchPercentage}%</p>
              </div>
            </div>
            {matchResult.tailoringPerformed && (
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <span className="text-emerald-400">✓</span> PDF generated successfully
              </p>
            )}
          </div>
        ) : (
          <div className="mb-5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-900/10 fade-in">
            <p className="text-emerald-400 font-medium text-xs text-center">
              Existing resume is already optimized for this job.
            </p>
          </div>
        )
      )}

      {/* Best resume card */}
      {best && (
        <div className="p-4 rounded-xl bg-emerald-900/10 border border-emerald-500/20 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-400 text-xs font-bold">PDF</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{p.name || best.originalName}</p>
              <p className="text-xs text-slate-400 truncate">{best.originalName}</p>
              {p.idealRole && <p className="text-xs text-brand-400 mt-0.5">{p.idealRole}</p>}
            </div>
            <span className="ml-auto badge-green flex-shrink-0">✓ Selected</span>
            <button
              onClick={() => {
                const url = `${API}/resumes/download/${encodeURIComponent(best.filename)}?isTailored=${best.isTailored || false}`;
                window.open(url, '_blank');
              }}
              className="ml-2 text-slate-400 hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-emerald-900/20"
              title="Download PDF"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>

          {matchResult.bestMatchReason && (
            <div className="mt-3 p-3 bg-navy-900/40 rounded-lg">
              <p className="text-xs text-emerald-400 font-medium mb-1">Why this resume?</p>
              <p className="text-xs text-slate-300 leading-relaxed">{matchResult.bestMatchReason}</p>
            </div>
          )}

          {/* Strengths */}
          {bestRanking?.strengths?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-emerald-400 font-medium mb-1.5">✅ Strengths</p>
              <ul className="space-y-1">
                {bestRanking.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-emerald-500 flex-shrink-0 mt-0.5">›</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {bestRanking?.gaps?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-amber-400 font-medium mb-1.5">⚠️ Gaps</p>
              <ul className="space-y-1">
                {bestRanking.gaps.map((g, i) => (
                  <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">›</span>{g}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key skills */}
          {p.skills?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-2">Key skills</p>
              <div className="flex flex-wrap gap-1.5">
                {p.skills.slice(0, 10).map((s, i) => (
                  <span key={i} className="badge-green text-xs">{s}</span>
                ))}
                {p.skills.length > 10 && <span className="text-xs text-slate-500">+{p.skills.length - 10}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other Matches */}
      {rankings.filter(r => matchResult.tailoringPerformed || r.index !== matchResult.bestMatchIndex).length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Other Matches</p>
          <div className="space-y-2">
            {rankings
              .filter(r => matchResult.tailoringPerformed || r.index !== matchResult.bestMatchIndex)
              .map((ranking, i) => {
                const resume = ranking.resume;
                return (
                  <div
                    key={i}
                    className="p-3 rounded-xl border transition-all bg-navy-900/30 border-white/5 flex items-center gap-3 fade-in"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {resume?.parsedData?.name || resume?.originalName || `Resume ${ranking.index + 1}`}
                      </p>
                      {resume?.parsedData?.idealRole && (
                        <p className="text-xs text-slate-500 truncate">{resume.parsedData.idealRole}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-bold ${
                        ranking.score >= 80 ? 'text-emerald-400' :
                        ranking.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {ranking.score}%
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const url = `${API}/resumes/download/${encodeURIComponent(resume.filename)}?isTailored=${resume.isTailored || false}`;
                        window.open(url, '_blank');
                      }}
                      className="ml-2 text-slate-400 hover:text-brand-400 transition-colors p-1.5 rounded-lg hover:bg-brand-900/20"
                      title="Download PDF"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
