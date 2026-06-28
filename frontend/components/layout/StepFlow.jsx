// Shared step indicator for Apply → Analysis → Email flow
export default function StepFlow({ current, steps = ['Apply', 'Analysis', 'Email'] }) {
  return (
    <nav aria-label="Application progress" className="mb-6 sm:mb-8 overflow-x-auto -mx-1 px-1 pb-1">
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-[min(100%,280px)]">
        {steps.map((label, i) => {
          const idx = i + 1;
          const isDone = idx < current;
          const isActive = idx === current;
          return (
            <div key={label} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none min-w-0">
              <div
                className={`flex items-center gap-1.5 sm:gap-2 min-w-0 ${
                  isActive ? 'text-white' : isDone ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <div className={isActive ? 'step-dot-active' : isDone ? 'step-dot-done' : 'step-dot-idle'}>
                  {isDone ? '✓' : idx}
                </div>
                <span className="text-[11px] sm:text-xs font-medium truncate max-w-[4.5rem] xs:max-w-none sm:max-w-none">
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-px min-w-[12px] ${
                    isDone ? 'bg-gradient-to-r from-emerald-500/40 to-brand-500/40' : 'bg-white/5'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
