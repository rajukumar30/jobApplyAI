// AnalysisProgressModal — full-screen modal showing real-time pipeline steps
// Steps animate in sequentially with a slide-up effect.

import { useEffect, useState } from 'react';

const STATUS_ICONS = {
  done:    <span className="text-emerald-400 text-base leading-none">✓</span>,
  running: (
    <svg className="w-4 h-4 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  ),
  error:   <span className="text-red-400 text-base leading-none">✗</span>,
  warn:    <span className="text-amber-400 text-base leading-none">⚠</span>,
  idle:    <span className="text-slate-600 text-base leading-none">○</span>,
};

const STATUS_BORDER = {
  done:    'border-emerald-500/20 bg-emerald-900/10',
  running: 'border-brand-500/40 bg-brand-900/15',
  error:   'border-red-500/20 bg-red-900/10',
  warn:    'border-amber-500/20 bg-amber-900/10',
  idle:    'border-white/5 bg-transparent',
};

const STATUS_TEXT = {
  done:    'text-slate-200',
  running: 'text-white font-semibold',
  error:   'text-red-300',
  warn:    'text-amber-300',
  idle:    'text-slate-500',
};

function StepItem({ step, visible }) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${STATUS_BORDER[step.status] || STATUS_BORDER.idle} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transition: 'opacity 0.4s ease, transform 0.4s ease, background 0.3s ease, border-color 0.3s ease' }}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
        {STATUS_ICONS[step.status] || STATUS_ICONS.idle}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${STATUS_TEXT[step.status] || STATUS_TEXT.idle}`}>{step.label}</p>
        {step.detail && (
          <p className={`text-xs mt-0.5 leading-relaxed ${
            step.status === 'running' ? 'text-brand-400/80' :
            step.status === 'error'   ? 'text-red-400/80' :
            step.status === 'warn'    ? 'text-amber-400/70' :
            'text-slate-500'
          }`}>
            {step.detail}
          </p>
        )}
      </div>
      {step.status === 'running' && (
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

export default function AnalysisProgressModal({ isOpen, steps = [], onCancel }) {
  const [visibleCount, setVisibleCount] = useState(0);

  // Reveal steps progressively as they become non-idle
  useEffect(() => {
    const active = steps.filter(s => s.status !== 'idle').length;
    setVisibleCount(Math.max(active, 1));
  }, [steps]);

  if (!isOpen) return null;

  const activeStep = steps.find(s => s.status === 'running');
  const hasError = steps.some(s => s.status === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="modal-box w-full max-w-lg slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
            {hasError ? (
              <span className="text-xl">❌</span>
            ) : activeStep ? (
              <svg className="w-5 h-5 animate-spin text-brand-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span className="text-xl">✨</span>
            )}
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">
              {hasError ? 'Analysis Failed' : activeStep ? 'Analyzing Job…' : 'Analysis Complete!'}
            </h2>
            <p className="text-xs text-slate-400">
              {hasError ? 'An error occurred during processing.' : activeStep ? activeStep.label : 'Processing complete — redirecting…'}
            </p>
          </div>
        </div>

        {/* Progress steps */}
        <div className="space-y-2 mb-6">
          {steps.map((step, i) => (
            <StepItem key={step.id} step={step} visible={i < visibleCount} />
          ))}
        </div>

        {/* Overall progress bar */}
        {!hasError && (() => {
          const done = steps.filter(s => s.status === 'done' || s.status === 'warn').length;
          const pct = Math.round((done / steps.length) * 100);
          return (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Progress</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 bg-navy-900/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-blue-500 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Cancel button — only show while running */}
        {activeStep && !hasError && (
          <button
            onClick={onCancel}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
          >
            Cancel
          </button>
        )}

        {/* Error cancel */}
        {hasError && (
          <button onClick={onCancel} className="btn-secondary w-full justify-center">
            Close
          </button>
        )}
      </div>
    </div>
  );
}
