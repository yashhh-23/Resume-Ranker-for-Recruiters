const ScoreBar = ({ segments }) => {
  return (
    <div className="space-y-2.5" aria-label="Candidate score breakdown" role="group">
      {segments.map((segment) => {
        const percent = Math.round((segment.value ?? 0) * 100);
        const weightPct = Math.round((segment.weight ?? 0) * 100);
        return (
          <div key={segment.label} className="flex items-center gap-3 text-[11px] font-mono">
            {/* Label */}
            <span
              className="w-24 text-left shrink-0 truncate font-semibold"
              style={{ color: segment.colorCode, opacity: 0.85 }}
              title={`${segment.label} (weight: ${weightPct}%)`}
            >
              {segment.label}
            </span>

            {/* Bar track */}
            <div
              className="flex-1 relative h-3 bg-slate-900 border border-slate-800/80 rounded-none overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${segment.label}: ${percent}%`}
            >
              {/* Subtle weight guide line */}
              <div
                className="absolute top-0 bottom-0 border-r border-dashed border-slate-700/40"
                style={{ left: `${weightPct}%` }}
                title={`${weightPct}% weight allocation`}
              />
              {/* Filled bar */}
              <div
                className="h-full transition-all duration-700 ease-out"
                style={{
                  width: `${percent}%`,
                  backgroundColor: segment.colorCode,
                  boxShadow: `0 0 8px ${segment.colorCode}55`,
                }}
              />
            </div>

            {/* Percentage */}
            <span
              className="w-9 text-right font-bold text-sm shrink-0"
              style={{ color: segment.colorCode }}
            >
              {percent}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ScoreBar;
