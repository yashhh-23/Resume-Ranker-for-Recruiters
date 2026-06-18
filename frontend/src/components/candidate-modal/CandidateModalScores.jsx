import { memo } from "react";
import { formatPercent, formatScore } from "../../utils/formatters";
import { SKILL_WEIGHT, CAREER_WEIGHT, SIGNAL_WEIGHT, EDUCATION_WEIGHT, AVAILABILITY_WEIGHT } from "../../constants/weights";
import CopyButton from "../CopyButton";
import { buildScoreTableCopy } from "../../utils/copyUtils";

const CandidateModalScores = memo(({
  breakdown = {},
  score = 0,
}) => {
  const skillMatch = breakdown.skill_match ?? 0;
  const careerFit = breakdown.career_fit ?? 0;
  const signalModifier = breakdown.signal_modifier ?? 0;
  const educationScore = breakdown.education ?? 0;
  const availabilityScore = breakdown.availability ?? 0;

  const rows = [
    { label: "Skill Match", val: skillMatch, weight: SKILL_WEIGHT, color: "bg-[#10B981]", textColor: "text-[#10B981]" },
    { label: "Career Fit", val: careerFit, weight: CAREER_WEIGHT, color: "bg-[#3B82F6]", textColor: "text-[#3B82F6]" },
    { label: "Signal Mod.", val: signalModifier, weight: SIGNAL_WEIGHT, color: "bg-[#6366F1]", textColor: "text-[#6366F1]" },
    { label: "Education", val: educationScore, weight: EDUCATION_WEIGHT, color: "bg-[#14B8A6]", textColor: "text-[#14B8A6]" },
    { label: "Availability", val: availabilityScore, weight: AVAILABILITY_WEIGHT, color: "bg-[#D97706]", textColor: "text-[#D97706]" },
  ];

  return (
    <div className="px-6 py-5 border-b border-slate-900 bg-slate-950/60 font-mono text-xs">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">5-Dimensional Discovery Scores &amp; Waterfall Math</h4>
        <CopyButton
          plain={buildScoreTableCopy(rows, score).plain}
          html={buildScoreTableCopy(rows, score).html}
          label="Copy score breakdown table"
        />
      </div>
      
      {/* Stacked Waterfall Progress Bar */}
      <div className="h-4 w-full bg-slate-900 overflow-hidden flex border border-slate-800 rounded-none mb-5">
        {rows.map((row, idx) => {
          const contribPct = row.val * row.weight * 100;
          return (
            <div
              key={idx}
              className={`${row.color} h-full transition-all duration-500`}
              style={{ width: `${contribPct}%` }}
              title={`${row.label}: ${formatPercent(row.val)} score × ${row.weight * 100}% weight = +${formatPercent(row.val * row.weight)} contribution`}
            />
          );
        })}
      </div>

      {/* Math grid table */}
      <div className="border border-slate-900 bg-slate-950 p-4 overflow-x-auto rounded-none">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-900 text-[9px] uppercase tracking-wider text-slate-500">
              <th scope="col" className="pb-2">Evaluation Metric</th>
              <th scope="col" className="pb-2 text-right">Score</th>
              <th scope="col" className="pb-2 text-center">Weight</th>
              <th scope="col" className="pb-2 text-right">Contribution</th>
              <th scope="col" className="pb-2 pl-4 hidden sm:block">Waterfall Accumulation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/50">
            {(() => {
              let cumulative = 0;
              return rows.map((row, idx) => {
                const contrib = row.val * row.weight;
                cumulative += contrib;
                return (
                  <tr key={idx} className="hover:bg-slate-900/10">
                    <td className="py-2.5 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-none shrink-0 ${row.color}`} />
                      <span className="text-slate-300 font-semibold">{row.label}</span>
                    </td>
                    <td className={`py-2.5 text-right font-bold ${row.textColor}`}>{formatPercent(row.val)}</td>
                    <td className="py-2.5 text-center text-slate-400">× {Math.round(row.weight * 100)}%</td>
                    <td className={`py-2.5 text-right font-bold ${row.textColor}`}>+{formatPercent(contrib)}</td>
                    <td className="py-2.5 pl-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-900 h-2 border border-slate-800 relative">
                          <div className={`${row.color} h-full`} style={{ width: `${cumulative * 100}%` }} />
                        </div>
                        <span className="text-slate-500 text-[10px]">{formatPercent(cumulative)}</span>
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
            {/* Total Row */}
            <tr className="border-t-2 border-slate-900 font-bold bg-slate-950/40">
              <td className="py-3 text-slate-200 uppercase tracking-wider text-[10px]">Overall Fit Index</td>
              <td className="py-3"></td>
              <td className="py-3"></td>
              <td className="py-3 text-right text-emerald text-sm">{formatScore(score)}</td>
              <td className="py-3 pl-4 hidden sm:table-cell">
                <span className="text-emerald text-xs">{formatPercent(score)} overall fit alignment</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

CandidateModalScores.displayName = "CandidateModalScores";

export default CandidateModalScores;
