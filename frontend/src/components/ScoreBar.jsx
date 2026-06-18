import { memo } from "react";
import { SCORE_TIERS } from "../constants/scoreThresholds";

export const getBarColor = (score) => {
  const val = score <= 1 ? score : score / 100;
  if (val >= SCORE_TIERS.HIGH)   return "#10B981"; // emerald
  if (val >= SCORE_TIERS.MEDIUM) return "#F59E0B"; // amber
  return "#F43F5E"; // rose
};

const ScoreBar = memo(({ segments }) => {
  return (
    <div className="space-y-2.5" aria-label="Candidate score breakdown" role="group">
      {segments.map((segment) => {
        const percent = Math.round((segment.value ?? 0) * 100);
        const weightPct = Math.round((segment.weight ?? 0) * 100);
        const color = segment.colorCode || getBarColor(segment.value);

        return (
          <div key={segment.label} className="flex items-center gap-3 text-[11px] font-mono relative group/segment">
            {/* Label */}
            <span
              className="w-24 text-left shrink-0 truncate font-semibold"
              style={{ color: color, opacity: 0.85 }}
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
                  backgroundColor: color,
                  boxShadow: `0 0 8px ${color}55`,
                }}
              />
            </div>

            {/* Percentage */}
            <span
              className="w-9 text-right font-bold text-sm shrink-0"
              style={{ color: color }}
            >
              {percent}%
            </span>

            {/* Segment Hover Tooltip */}
            {segment.tooltipContent && (
              <div className="opacity-0 group-hover/segment:opacity-100 transition-opacity duration-150 absolute bottom-full left-24 mb-1.5 z-50 pointer-events-none w-60 p-2.5 bg-slate-950 border border-slate-800 text-slate-300 shadow-xl text-[10px] leading-normal font-mono rounded-none">
                <span className="text-white font-bold block mb-1 uppercase tracking-wide">{segment.label} Details:</span>
                {segment.tooltipContent}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

ScoreBar.displayName = "ScoreBar";

export default ScoreBar;
