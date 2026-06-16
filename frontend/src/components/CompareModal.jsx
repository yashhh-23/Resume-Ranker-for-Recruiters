import { formatPercent, formatScore } from "../utils/formatters";
import { deriveBreakdown } from "../utils/scoreUtils";

/**
 * CompareModal — Side-by-side comparison of exactly 2 candidates.
 * Shows score breakdown as a custom SVG radar/pentagon chart plus tabular diff.
 */

const SCORE_AXES = [
  { key: "skill_match", label: "Skill Match", weight: "35%", color: "#10B981" },
  { key: "career_fit", label: "Career Fit", weight: "25%", color: "#3B82F6" },
  { key: "signal_modifier", label: "Signals", weight: "15%", color: "#6366F1" },
  { key: "education", label: "Education", weight: "15%", color: "#14B8A6" },
  { key: "availability", label: "Availability", weight: "10%", color: "#D97706" },
];

// SVG Pentagon Radar Chart
const RadarChart = ({ breakdownA, breakdownB, nameA, nameB }) => {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 85;
  const n = SCORE_AXES.length;

  // Calculate points for a regular pentagon
  const angleOf = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointOnAxis = (i, r) => ({
    x: cx + r * Math.cos(angleOf(i)),
    y: cy + r * Math.sin(angleOf(i)),
  });

  const toPath = (values) =>
    values
      .map((v, i) => {
        const r = maxR * v;
        const p = pointOnAxis(i, r);
        return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      })
      .join(" ") + " Z";

  const axisPoints = SCORE_AXES.map((_, i) => pointOnAxis(i, maxR));

  const valuesA = SCORE_AXES.map((ax) => breakdownA[ax.key] ?? 0);
  const valuesB = SCORE_AXES.map((ax) => breakdownB[ax.key] ?? 0);

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={SCORE_AXES.map((_, i) => {
            const p = pointOnAxis(i, maxR * r);
            return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {axisPoints.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}

      {/* Candidate A area */}
      <path
        d={toPath(valuesA)}
        fill="rgba(16,185,129,0.15)"
        stroke="#10B981"
        strokeWidth="1.5"
      />

      {/* Candidate B area */}
      <path
        d={toPath(valuesB)}
        fill="rgba(59,130,246,0.15)"
        stroke="#3B82F6"
        strokeWidth="1.5"
        strokeDasharray="4 2"
      />

      {/* Axis labels */}
      {SCORE_AXES.map((ax, i) => {
        const p = pointOnAxis(i, maxR + 18);
        return (
          <text
            key={ax.key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="#94a3b8"
            fontFamily="JetBrains Mono, monospace"
          >
            {ax.label}
          </text>
        );
      })}
    </svg>
  );
};

const ScoreRow = ({ label, color, valueA, valueB, weight }) => {
  const diff = valueA - valueB;
  const winner = diff > 0.01 ? "A" : diff < -0.01 ? "B" : null;
  return (
    <div className="grid grid-cols-7 items-center gap-2 py-1.5 border-b border-slate-900/50 font-mono text-xs">
      <div className="col-span-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
        <span className="text-slate-400 truncate">{label}</span>
        <span className="text-slate-600 text-[9px]">({weight})</span>
      </div>
      <div className="col-span-2 text-right">
        <span className={`font-bold ${winner === "A" ? "text-emerald" : "text-slate-300"}`}>
          {formatPercent(valueA)}
        </span>
        {winner === "A" && <span className="text-emerald text-[9px] ml-1">▲</span>}
      </div>
      <div className="col-span-1 text-center text-slate-700">|</div>
      <div className="col-span-2 text-left">
        <span className={`font-bold ${winner === "B" ? "text-cobalt" : "text-slate-300"}`}>
          {formatPercent(valueB)}
        </span>
        {winner === "B" && <span className="text-cobalt text-[9px] ml-1">▲</span>}
      </div>
    </div>
  );
};

const CompareModal = ({ candidateA, resultA, candidateB, resultB, onClose }) => {
  const profileA = candidateA?.profile || {};
  const profileB = candidateB?.profile || {};
  const breakdownA = deriveBreakdown(resultA, candidateA);
  const breakdownB = deriveBreakdown(resultB, candidateB);

  const signalsA = candidateA?.redrob_signals || {};
  const signalsB = candidateB?.redrob_signals || {};

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] rounded-none overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-mono">Head-to-Head Matrix</p>
            <h3 className="text-lg font-bold text-white mt-0.5">Candidate Comparison</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs uppercase tracking-wider font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-none transition-all duration-200"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Candidate Name Headers */}
          <div className="grid grid-cols-7 gap-2 font-mono">
            <div className="col-span-2" />
            <div className="col-span-2 text-center border border-emerald/30 bg-emerald/5 py-3 px-2 rounded-none">
              <p className="text-[9px] uppercase tracking-widest text-emerald mb-1 font-bold">Candidate A</p>
              <p className="text-sm font-bold text-slate-100 truncate">{profileA.anonymized_name || resultA?.candidate_id}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{profileA.current_title || "—"}</p>
              <p className="text-lg font-bold text-emerald mt-2">{formatScore(resultA?.score)}</p>
              <p className="text-[9px] text-slate-500">Rank #{resultA?.rank}</p>
            </div>
            <div className="col-span-1" />
            <div className="col-span-2 text-center border border-cobalt/30 bg-cobalt/5 py-3 px-2 rounded-none">
              <p className="text-[9px] uppercase tracking-widest text-cobalt mb-1 font-bold">Candidate B</p>
              <p className="text-sm font-bold text-slate-100 truncate">{profileB.anonymized_name || resultB?.candidate_id}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">{profileB.current_title || "—"}</p>
              <p className="text-lg font-bold text-cobalt mt-2">{formatScore(resultB?.score)}</p>
              <p className="text-[9px] text-slate-500">Rank #{resultB?.rank}</p>
            </div>
          </div>

          {/* Radar chart + score rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Pentagon Radar */}
            <div className="border border-slate-900 bg-slate-900/20 p-4 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-3 text-center">Score Radar Overlay</p>
              <RadarChart
                breakdownA={breakdownA}
                breakdownB={breakdownB}
                nameA={profileA.anonymized_name}
                nameB={profileB.anonymized_name}
              />
              <div className="flex justify-center gap-6 mt-3 font-mono text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-emerald inline-block" />
                  <span className="text-slate-400">Candidate A</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-cobalt inline-block border-b border-dashed border-cobalt" style={{borderStyle:'dashed'}} />
                  <span className="text-slate-400">Candidate B</span>
                </span>
              </div>
            </div>

            {/* Score breakdown table */}
            <div className="border border-slate-900 bg-slate-900/20 p-4 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-3">Score Breakdown Diff</p>
              <div className="grid grid-cols-7 text-[9px] font-mono text-slate-600 uppercase tracking-wider mb-2 gap-2">
                <span className="col-span-2">Signal</span>
                <span className="col-span-2 text-right text-emerald">Cand A</span>
                <span className="col-span-1" />
                <span className="col-span-2 text-left text-cobalt">Cand B</span>
              </div>
              {SCORE_AXES.map((ax) => (
                <ScoreRow
                  key={ax.key}
                  label={ax.label}
                  color={ax.color}
                  weight={ax.weight}
                  valueA={breakdownA[ax.key] ?? 0}
                  valueB={breakdownB[ax.key] ?? 0}
                />
              ))}
              {/* Overall */}
              <div className="grid grid-cols-7 items-center gap-2 pt-2 font-mono text-xs border-t border-slate-800 mt-1">
                <div className="col-span-2 text-slate-300 font-bold uppercase text-[10px] tracking-wider">Overall</div>
                <div className="col-span-2 text-right">
                  <span className={`font-bold text-sm ${(resultA?.score ?? 0) >= (resultB?.score ?? 0) ? "text-emerald" : "text-slate-400"}`}>
                    {formatScore(resultA?.score)}
                  </span>
                </div>
                <div className="col-span-1 text-center text-slate-700">|</div>
                <div className="col-span-2 text-left">
                  <span className={`font-bold text-sm ${(resultB?.score ?? 0) > (resultA?.score ?? 0) ? "text-cobalt" : "text-slate-400"}`}>
                    {formatScore(resultB?.score)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick facts comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {[
              ["Experience", `${profileA.years_of_experience ?? "—"} yrs`, `${profileB.years_of_experience ?? "—"} yrs`],
              ["Skills Count", candidateA?.skills?.length ?? 0, candidateB?.skills?.length ?? 0],
              ["Notice Period", `${signalsA.notice_period_days ?? "—"} days`, `${signalsB.notice_period_days ?? "—"} days`],
              ["Open to Work", signalsA.open_to_work_flag ? "Yes" : "No", signalsB.open_to_work_flag ? "Yes" : "No"],
              ["Recruiter Resp.", formatPercent(signalsA.recruiter_response_rate), formatPercent(signalsB.recruiter_response_rate)],
              ["GitHub Score", signalsA.github_activity_score === -1 ? "N/A" : (signalsA.github_activity_score ?? "—"), signalsB.github_activity_score === -1 ? "N/A" : (signalsB.github_activity_score ?? "—")],
            ].map(([label, valA, valB]) => (
              <div key={label} className="border border-slate-900 bg-slate-900/10 p-3 rounded-none">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">{label}</p>
                <div className="flex justify-between items-center">
                  <span className="text-slate-200 font-bold">{valA}</span>
                  <span className="text-slate-700 text-[10px]">vs</span>
                  <span className="text-slate-200 font-bold">{valB}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareModal;
