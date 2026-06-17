import { formatPercent, formatScore } from "../utils/formatters";
import { deriveBreakdown } from "../utils/scoreUtils";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

/**
 * CompareModal — Side-by-side comparison of up to 3 candidates.
 * Uses Recharts RadarChart for dynamic polygon overlays.
 */

const SCORE_AXES = [
  { key: "skill_match", label: "Skills", weight: "35%", color: "#10B981" },
  { key: "career_fit", label: "Career", weight: "25%", color: "#3B82F6" },
  { key: "signal_modifier", label: "Signals", weight: "15%", color: "#6366F1" },
  { key: "education", label: "Education", weight: "15%", color: "#14B8A6" },
  { key: "availability", label: "Availability", weight: "10%", color: "#D97706" },
];

const COLORS = ["#10B981", "#3B82F6", "#D97706"];

const CompareModal = ({ selectedCandidates = [], onClose }) => {
  if (selectedCandidates.length === 0) return null;

  // Prepare data for Recharts RadarChart
  const radarData = SCORE_AXES.map((axis) => {
    const dataPoint = { subject: axis.label, fullMark: 1.0 };
    selectedCandidates.forEach((item, index) => {
      const breakdown = deriveBreakdown(item.result, item.candidate);
      dataPoint[`cand${index}`] = breakdown[axis.key] ?? 0;
    });
    return dataPoint;
  });

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
          <div className="grid gap-4 font-mono" style={{ gridTemplateColumns: `repeat(${selectedCandidates.length}, minmax(0, 1fr))` }}>
            {selectedCandidates.map((item, idx) => {
              const profile = item.candidate?.profile || {};
              const borderColors = [
                "border-emerald/30 bg-emerald/5",
                "border-cobalt/30 bg-cobalt/5",
                "border-amber/30 bg-amber/5"
              ];
              const textColors = [
                "text-emerald",
                "text-cobalt",
                "text-amber"
              ];
              return (
                <div key={item.candidate_id} className={`text-center border py-3 px-2 rounded-none ${borderColors[idx]}`}>
                  <p className={`text-[9px] uppercase tracking-widest mb-1 font-bold ${textColors[idx]}`}>Candidate {String.fromCharCode(65 + idx)}</p>
                  <p className="text-sm font-bold text-slate-100 truncate">{profile.anonymized_name || item.result?.candidate_id}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">{profile.current_title || "—"}</p>
                  <p className={`text-lg font-bold mt-2 ${textColors[idx]}`}>{formatScore(item.result?.score)}</p>
                  <p className="text-[9px] text-slate-500">Rank #{item.result?.rank}</p>
                </div>
              );
            })}
          </div>

          {/* Radar chart + score rows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Pentagon Radar Chart using Recharts */}
            <div className="border border-slate-900 bg-slate-900/20 p-4 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-3 text-center">Score Radar Overlay</p>
              <div className="h-[250px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }} />
                    <PolarRadiusAxis domain={[0, 1.0]} tick={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '0',
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}
                      formatter={(value, name) => [`${(value * 100).toFixed(1)}%`, name]}
                    />
                    {selectedCandidates.map((item, idx) => (
                      <Radar
                        key={item.candidate_id}
                        name={`Candidate ${String.fromCharCode(65 + idx)}`}
                        dataKey={`cand${idx}`}
                        stroke={COLORS[idx]}
                        fill={COLORS[idx]}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingTop: 10 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score breakdown table */}
            <div className="border border-slate-900 bg-slate-900/20 p-4 rounded-none overflow-x-auto">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-3">Score Breakdown Diff</p>
              <table className="w-full font-mono text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-900 text-[9px] uppercase tracking-wider text-slate-600">
                    <th className="py-2 pr-4">Signal</th>
                    {selectedCandidates.map((item, idx) => (
                      <th key={idx} className="py-2 text-right" style={{ color: COLORS[idx] }}>
                        Cand {String.fromCharCode(65 + idx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {SCORE_AXES.map((ax) => (
                    <tr key={ax.key} className="hover:bg-slate-900/10">
                      <td className="py-2 pr-4 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ax.color }} />
                        <span className="text-slate-400">{ax.label}</span>
                        <span className="text-slate-600 text-[9px]">({ax.weight})</span>
                      </td>
                      {selectedCandidates.map((item, idx) => {
                        const breakdown = deriveBreakdown(item.result, item.candidate);
                        const val = breakdown[ax.key] ?? 0;
                        return (
                          <td key={idx} className="py-2 text-right font-bold text-slate-200">
                            {formatPercent(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Overall */}
                  <tr className="border-t border-slate-800 font-bold">
                    <td className="py-3 pr-4 text-slate-300 uppercase text-[10px] tracking-wider">Overall Fit</td>
                    {selectedCandidates.map((item, idx) => (
                      <td key={idx} className="py-3 text-right text-sm" style={{ color: COLORS[idx] }}>
                        {formatScore(item.result?.score)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick facts comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            {[
              ["Experience", (item) => `${item.candidate?.profile?.years_of_experience ?? "—"} yrs`],
              ["Skills Count", (item) => item.candidate?.skills?.length ?? 0],
              ["Notice Period", (item) => `${item.candidate?.redrob_signals?.notice_period_days ?? "—"} days`],
              ["Open to Work", (item) => item.candidate?.redrob_signals?.open_to_work_flag ? "Yes" : "No"],
              ["Recruiter Resp.", (item) => formatPercent(item.candidate?.redrob_signals?.recruiter_response_rate)],
              ["GitHub Score", (item) => {
                const gh = item.candidate?.redrob_signals?.github_activity_score;
                return gh === -1 ? "N/A" : (gh ?? "—");
              }],
            ].map(([label, getValue]) => (
              <div key={label} className="border border-slate-900 bg-slate-900/10 p-3 rounded-none">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">{label}</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedCandidates.length}, minmax(0, 1fr))` }}>
                  {selectedCandidates.map((item, idx) => (
                    <div key={item.candidate_id} className="text-left border-r border-slate-900 last:border-r-0 pr-2 last:pr-0">
                      <span className="text-[9px] uppercase text-slate-600 block mb-0.5">Cand {String.fromCharCode(65 + idx)}</span>
                      <span className="text-slate-200 font-bold">{getValue(item)}</span>
                    </div>
                  ))}
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
