import { useState } from 'react';
import { StepRow } from './AIPipelineProgress';

export default function JobAnalysisPanel({ jobData, fakeJobResult, loading, duplicateWarning, steps = [] }) {
  const [warningDismissed, setWarningDismissed] = useState(false);

  if (loading) {
    const analyzeStep = steps.find(s => s.id === 'analyze_job');
    return (
      <div className="glass-card p-6">
        <div className="panel-header mb-4">
          <div className="panel-icon bg-amber-600/20 text-amber-400"><BarChartIcon /></div>
          <div>
            <h2 className="font-semibold text-white text-base">Job Analysis</h2>
            <p className="text-xs text-slate-400">AI-extracted job requirements</p>
          </div>
        </div>
        {analyzeStep ? (
          <StepRow step={analyzeStep} />
        ) : (
          <div className="space-y-3">
            {[80, 60, 90, 70].map((w, i) => (
              <div key={i} className="skeleton h-5 rounded-lg" style={{ width: `${w}%` }} />
            ))}
            <div className="skeleton h-16 rounded-xl mt-4" />
          </div>
        )}
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="glass-card p-6">
        <div className="panel-header">
          <div className="panel-icon bg-amber-600/20 text-amber-400"><BarChartIcon /></div>
          <div>
            <h2 className="font-semibold text-white text-base">Job Analysis</h2>
            <p className="text-xs text-slate-400">AI-extracted job requirements</p>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-900/20 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm font-medium">No job analyzed yet</p>
          <p className="text-slate-500 text-xs mt-1">Analyze a job description to see extracted details</p>
        </div>
      </div>
    );
  }

  const j = jobData.jobData || jobData;
  const analyzeStep = steps.find(s => s.id === 'analyze_job');

  return (
    <div className="glass-card p-6 slide-up">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-icon bg-amber-600/20 text-amber-400"><BarChartIcon /></div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">Job Analysis</h2>
          <p className="text-xs text-slate-400">AI-extracted job requirements</p>
        </div>
        <span className="badge-green">Analyzed ✓</span>
      </div>

      {/* Duplicate Application Warning */}
      {duplicateWarning && !warningDismissed && (
        <div className="mb-5 p-4 rounded-xl border border-orange-500/40 bg-orange-900/20 fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-orange-300 font-semibold text-sm">⚠️ Duplicate Application Detected</p>
              <p className="text-orange-200/80 text-xs mt-1 leading-relaxed">{duplicateWarning.message}</p>
              <div className="mt-3 space-y-1.5">
                {duplicateWarning.previousApplications.map((app, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-orange-200/70 bg-orange-900/20 rounded-lg px-3 py-2">
                    <span className="text-orange-400">📅</span>
                    <span>Applied for <span className="text-orange-300 font-medium">{app.role}</span> on <span className="text-orange-300 font-medium">{app.date}</span></span>
                    {app.email && <span className="ml-auto text-orange-400/60 truncate">→ {app.email}</span>}
                  </div>
                ))}
              </div>
              <p className="text-orange-200/60 text-xs mt-3">You can still proceed — this is just a reminder.</p>
            </div>
            <button onClick={() => setWarningDismissed(true)} className="text-orange-400/60 hover:text-orange-300 transition-colors p-1 flex-shrink-0" title="Dismiss">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {duplicateWarning && warningDismissed && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-900/10 border border-orange-500/20 fade-in">
          <span className="text-orange-400 text-xs">⚠️</span>
          <p className="text-orange-300/70 text-xs flex-1">Previously applied to <span className="font-medium">{j.company}</span></p>
          <button onClick={() => setWarningDismissed(false)} className="text-xs text-orange-400/50 hover:text-orange-300 transition-colors">Show</button>
        </div>
      )}

      {/* Fake Job Detection Result */}
      {fakeJobResult && (
        <div className={`mb-6 p-5 rounded-xl border fade-in ${
          fakeJobResult.authenticity_score < 40 ? 'bg-red-900/10 border-red-500/30' :
          fakeJobResult.authenticity_score < 70 ? 'bg-orange-900/10 border-orange-500/30' :
          'bg-emerald-900/10 border-emerald-500/30'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🕵️</span>
              <h3 className="font-semibold text-slate-200">Fake Job Detection</h3>
            </div>
            <div className="text-right">
              <p className={`text-xl font-bold ${
                fakeJobResult.authenticity_score < 40 ? 'text-red-400' :
                fakeJobResult.authenticity_score < 70 ? 'text-orange-400' :
                'text-emerald-400'
              }`}>
                {fakeJobResult.authenticity_score}/100
              </p>
              <p className="text-xs text-slate-400">{fakeJobResult.risk_level}</p>
            </div>
          </div>

          {(fakeJobResult.signals_detected?.length > 0 || fakeJobResult.warnings?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-4 border-t border-white/5">
              {/* Signals */}
              {fakeJobResult.signals_detected?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-400 mb-2 uppercase tracking-wider">Signals (Positives)</p>
                  <ul className="space-y-1">
                    {fakeJobResult.signals_detected.map((signal, i) => (
                      <li key={i} className="text-xs text-emerald-300/80 flex items-start gap-1.5">
                        <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>{signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Warnings */}
              {fakeJobResult.warnings?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-2 uppercase tracking-wider">Warnings (Red Flags)</p>
                  <ul className="space-y-1">
                    {fakeJobResult.warnings.map((warning, i) => (
                      <li key={i} className="text-xs text-amber-300/80 flex items-start gap-1.5">
                        <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>{warning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-5">
        {/* Company + Role */}
        <div className="p-4 rounded-xl bg-navy-900/50 border border-white/5">
          <p className="text-lg font-bold text-white">{j.jobTitle || 'Unknown Role'}</p>
          <p className="text-brand-400 font-medium text-sm mt-0.5">{j.company || 'Unknown Company'}</p>
          {j.department && <p className="text-xs text-slate-500 mt-0.5">Team: {j.department}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            {j.location && <span className="badge bg-navy-700/80 text-slate-300 border border-white/10">📍 {j.location}</span>}
            {j.workMode && <span className="badge bg-navy-700/80 text-slate-300 border border-white/10">🏠 {j.workMode}</span>}
            {j.jobType && <span className="badge bg-navy-700/80 text-slate-300 border border-white/10">⏱ {j.jobType}</span>}
            {j.experienceLevel && <span className="badge bg-brand-900/30 text-brand-300 border border-brand-500/20">📊 {j.experienceLevel}</span>}
            {j.experienceYearsRequired && <span className="badge bg-navy-700/80 text-slate-300 border border-white/10">🗓 {j.experienceYearsRequired}</span>}
            {j.salaryRange && <span className="badge-green">💰 {j.salaryRange}</span>}
          </div>
        </div>

        {/* Recruiter */}
        {(j.recruiterName || j.recruiterEmail || j.applicationEmail) && (
          <div>
            <p className="section-label">Recruiter / Contact</p>
            <div className="p-3 rounded-xl bg-navy-900/40 border border-white/5 space-y-1">
              {j.recruiterName && <p className="text-sm text-slate-200 font-medium">👤 {j.recruiterName}</p>}
              {j.recruiterEmail && <p className="text-sm text-brand-400">✉️ {j.recruiterEmail}</p>}
              {j.applicationEmail && j.applicationEmail !== j.recruiterEmail && (
                <p className="text-sm text-brand-400">📬 Apply to: {j.applicationEmail}</p>
              )}
            </div>
          </div>
        )}

        {/* Job Summary */}
        {j.jobSummary && (
          <div>
            <p className="section-label">Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">{j.jobSummary}</p>
          </div>
        )}

        {/* Company Description */}
        {j.companyDescription && (
          <div>
            <p className="section-label">About the Company</p>
            <p className="text-sm text-slate-400 leading-relaxed">{j.companyDescription}</p>
          </div>
        )}

        {/* Required Skills */}
        {j.requiredSkills?.length > 0 && (
          <div>
            <p className="section-label">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {j.requiredSkills.map((skill, i) => (
                <span key={i} className="skill-tag">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Preferred Skills */}
        {j.preferredSkills?.length > 0 && (
          <div>
            <p className="section-label">Preferred / Nice to Have</p>
            <div className="flex flex-wrap gap-2">
              {j.preferredSkills.map((skill, i) => (
                <span key={i} className="badge bg-slate-800/60 text-slate-400 border border-white/10">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Tools & Technologies */}
        {j.toolsAndTechnologies?.length > 0 && (
          <div>
            <p className="section-label">Tools & Technologies</p>
            <div className="flex flex-wrap gap-2">
              {j.toolsAndTechnologies.map((tool, i) => (
                <span key={i} className="badge bg-blue-900/20 text-blue-300 border border-blue-500/20">{tool}</span>
              ))}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {j.responsibilities?.length > 0 && (
          <div>
            <p className="section-label">Responsibilities ({j.responsibilities.length})</p>
            <ul className="space-y-1.5">
              {j.responsibilities.slice(0, 8).map((resp, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-brand-500 mt-0.5 flex-shrink-0">›</span>
                  <span>{resp}</span>
                </li>
              ))}
              {j.responsibilities.length > 8 && (
                <li className="text-xs text-slate-500 pl-4">+{j.responsibilities.length - 8} more responsibilities</li>
              )}
            </ul>
          </div>
        )}

        {/* Required Qualifications */}
        {j.requiredQualifications?.length > 0 && (
          <div>
            <p className="section-label">Required Qualifications</p>
            <ul className="space-y-1">
              {j.requiredQualifications.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Benefits */}
        {j.benefits?.length > 0 && (
          <div>
            <p className="section-label">Benefits</p>
            <div className="flex flex-wrap gap-2">
              {j.benefits.map((b, i) => (
                <span key={i} className="badge bg-emerald-900/20 text-emerald-400 border border-emerald-500/20">{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}
