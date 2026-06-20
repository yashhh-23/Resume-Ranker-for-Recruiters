import { SearchIcon, LightningIcon, BarChartIcon } from "./icons";

const LOADING_PHASES = [
  { text: "Embedding candidates against JD...", Icon: SearchIcon },
  { text: "Scoring across 5 dimensions...", Icon: LightningIcon },
  { text: "Sorting top 100 by fit index...", Icon: BarChartIcon },
];

const LoadingPhaseDisplay = ({ loadingPhase }) => {
  return (
    <div className="flex flex-col">
      {/* Staged status message */}
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-emerald/10 border-t-emerald animate-spin" />
          <div className="absolute inset-1.5 rounded-full border border-emerald/20 border-b-emerald/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
        </div>
        <div className="text-center">
          <div className="text-sm font-mono text-emerald tracking-wide font-semibold flex items-center justify-center gap-2">
            {(() => {
              const phase = LOADING_PHASES[Math.min(loadingPhase, LOADING_PHASES.length - 1)];
              const IconComponent = phase.Icon;
              return (
                <>
                  <IconComponent className="h-4 w-4 shrink-0 text-emerald animate-pulse" />
                  <span>{phase.text}</span>
                </>
              );
            })()}
          </div>
          <p className="text-xs font-mono text-slate-600 mt-1">CPU-only · offline-capable · up to 5,000 candidates</p>
        </div>
        {/* Phase dots */}
        <div className="flex gap-2">
          {LOADING_PHASES.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === loadingPhase ? "w-6 bg-emerald" : i < loadingPhase ? "w-3 bg-emerald/40" : "w-3 bg-slate-800"
              }`}
            />
          ))}
        </div>
      </div>
      {/* Skeleton cards */}
      <div className="divide-y divide-slate-900/60 px-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="px-6 py-5" style={{ opacity: 1 - i * 0.15 }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="h-5 w-8 bg-slate-900 rounded-none animate-pulse" />
                  <div className="h-5 w-36 bg-slate-800 rounded-none animate-pulse" />
                  <div className="h-4 w-20 bg-slate-900 rounded-none animate-pulse" />
                </div>
                <div className="h-3.5 w-64 bg-slate-900 rounded-none animate-pulse" />
                <div className="h-3 w-48 bg-slate-900/60 rounded-none animate-pulse" />
              </div>
              <div className="h-10 w-16 bg-slate-900 rounded-none animate-pulse shrink-0" />
            </div>
            <div className="mt-4 h-3 w-full bg-slate-900 rounded-none animate-pulse" />
            <div className="mt-2 h-8 w-full bg-slate-900/60 rounded-none animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingPhaseDisplay;
