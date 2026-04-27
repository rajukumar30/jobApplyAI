// AI Pipeline Progress Component
// Shows step-by-step status during job analysis → resume match → tailor flow

export default function AIPipelineProgress({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="glass-card p-5 slide-up">
      <div className="panel-header mb-4">
        <div className="panel-icon bg-brand-600/20 text-brand-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.698-1.352 2.698H4.15c-1.382 0-2.352-1.698-1.352-2.698L4.8 15.3" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-white text-base">AI Pipeline</h2>
          <p className="text-xs text-slate-400">Processing your application in real-time</p>
        </div>
        {/* Overall spinner if any step is running */}
        {steps.some(s => s.status === 'running') && (
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepRow key={i} step={step} index={i} />
        ))}
      </div>
    </div>
  );
}

export function StepRow({ step, index }) {
  const { label, detail, status, score, isWarning } = step;

  const iconMap = {
    done:    <span className="text-emerald-400 text-base">✓</span>,
    running: (
      <svg className="w-4 h-4 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ),
    error:   <span className="text-red-400 text-base">✗</span>,
    warn:    <span className="text-amber-400 text-base">⚠</span>,
    idle:    <span className="text-slate-600 text-base">○</span>,
  };

  const borderMap = {
    done:    'border-emerald-500/20 bg-emerald-900/10',
    running: 'border-brand-500/40 bg-brand-900/15',
    error:   'border-red-500/20 bg-red-900/10',
    warn:    'border-amber-500/20 bg-amber-900/10',
    idle:    'border-white/5 bg-transparent',
  };

  const labelMap = {
    done:    'text-slate-200',
    running: 'text-white',
    error:   'text-red-300',
    warn:    'text-amber-300',
    idle:    'text-slate-500',
  };

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${borderMap[status] || borderMap.idle}`}>
      {/* Step icon */}
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
        {iconMap[status] || iconMap.idle}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${labelMap[status] || labelMap.idle}`}>{label}</p>
          {/* Inline score badge */}
          {score !== undefined && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              score >= 80 ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/30' :
              score >= 60 ? 'bg-amber-900/40 text-amber-400 border border-amber-500/30' :
              'bg-red-900/40 text-red-400 border border-red-500/30'
            }`}>
              {score}% match
            </span>
          )}
          {isWarning && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-500/20">
              Low match — tailoring
            </span>
          )}
        </div>
        {detail && (
          <p className={`text-xs mt-0.5 leading-relaxed ${
            status === 'running' ? 'text-brand-400/80' :
            status === 'error'   ? 'text-red-400/80' :
            status === 'warn'    ? 'text-amber-400/70' :
            'text-slate-500'
          }`}>
            {detail}
          </p>
        )}
      </div>

      {/* Running pulse indicator */}
      {status === 'running' && (
        <div className="flex-shrink-0 flex gap-0.5 items-center mt-1.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-1 h-1 rounded-full bg-brand-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
