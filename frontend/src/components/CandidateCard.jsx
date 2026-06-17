import { useState, useRef, useEffect } from "react";
import ScoreBar from "./ScoreBar";
import { detectTimelineAnomaly, deriveBreakdown, deriveReasoning } from "../utils/scoreUtils";
import { formatScore, formatPercent } from "../utils/formatters";
import { extractJdSkills, isSkillMatchedInJd } from "../utils/jdUtils";

const CandidateCard = ({
  result,
  candidate,
  onSelect,
  talentPools = [],
  onOpenPoolManager,
  inPoolView = false,
  poolId = null,
  onRemoveCandidateFromTalentPool,
  jobDescription = "",
  // Compare mode props
  isCompareSelected = false,
  onToggleCompare = null,
}) => {
  const profile = candidate?.profile || {};
  const breakdown = deriveBreakdown(result, candidate);
  const reasoning = deriveReasoning(result, candidate);
  const anomaly = detectTimelineAnomaly(candidate);
  const topSkills = (candidate?.skills || []).slice(0, 5);

  // Extract JD skill tokens for matching
  const jdSkillTokens = extractJdSkills(jobDescription);
  const hasJdSkills = jdSkillTokens.length > 0;

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0, placeBelow: false });
  const containerRef = useRef(null);

  const updateTooltipPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipHeight = 190;
    const placeBelow = rect.top - tooltipHeight < 10;
    setTooltipCoords({
      top: placeBelow ? rect.bottom + 8 : rect.top - 8,
      left: rect.left + rect.width / 2,
      placeBelow,
    });
  };

  const handleMouseEnter = () => { updateTooltipPosition(); setShowTooltip(true); };
  const handleMouseMove = () => { updateTooltipPosition(); };
  const handleMouseLeave = () => { setShowTooltip(false); };

  useEffect(() => {
    if (!showTooltip) return;
    const handleScroll = () => updateTooltipPosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [showTooltip]);

  const getScoreColor = (score) => {
    const val = score <= 1 ? score * 100 : score;
    if (val >= 80) return "text-emerald border-emerald/20 bg-emerald/5";
    if (val >= 60) return "text-cobalt border-cobalt/20 bg-cobalt/5";
    return "text-slate-400 border-slate-800 bg-slate-900/40";
  };

  const isInAnyPool = talentPools.some((p) =>
    p.candidates.some((c) => c.candidate_id === result.candidate_id)
  );

  // Count matched JD skills for this candidate
  const matchedSkillCount = hasJdSkills
    ? topSkills.filter((s) => isSkillMatchedInJd(s.name, jdSkillTokens)).length
    : 0;

  return (
    <div
      onClick={onSelect}
      className={`w-full text-left px-6 py-5 hover:bg-slate-900/30 border-l-2 transition-all duration-300 ease-in-out bg-canvas rounded-none cursor-pointer ${
        isCompareSelected
          ? "border-l-amber bg-amber/5"
          : "border-l-transparent hover:border-l-emerald/70"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Compare checkbox */}
            {onToggleCompare && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleCompare(result.candidate_id); }}
                title={isCompareSelected ? "Deselect from comparison" : "Select for comparison"}
                className={`h-4 w-4 shrink-0 border transition-all duration-200 flex items-center justify-center rounded-none ${
                  isCompareSelected
                    ? "border-amber bg-amber/20 text-amber"
                    : "border-slate-700 bg-slate-950 text-transparent hover:border-slate-500"
                }`}
              >
                {isCompareSelected && (
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            )}
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-none bg-slate-900 border border-slate-800 text-[10px] font-bold font-mono text-slate-400">
              #{result.rank}
            </span>
            <h3 className="text-base font-semibold text-slate-100 group-hover:text-emerald transition-colors duration-200">
              {profile.anonymized_name || "Unknown Candidate"}
            </h3>
            <span className="text-[10px] text-slate-600 font-mono">
              {result.candidate_id}
            </span>
            {/* JD skill match indicator badge */}
            {hasJdSkills && matchedSkillCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald/10 border border-emerald/30 text-emerald text-[9px] font-mono rounded-none">
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {matchedSkillCount} JD match{matchedSkillCount !== 1 ? "es" : ""}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-300 mt-1.5 line-clamp-1">{profile.headline}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {profile.current_title} · {profile.current_company} · {profile.location}
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {onOpenPoolManager && (
            <button
              type="button"
              onClick={(e) => onOpenPoolManager(candidate, result, e)}
              className={`p-1.5 border transition-all duration-200 rounded-none ${
                isInAnyPool
                  ? "border-emerald/40 bg-emerald/10 text-emerald hover:bg-emerald/20"
                  : "border-slate-800 bg-slate-950/60 text-slate-500 hover:text-slate-300 hover:border-slate-700"
              }`}
              title={isInAnyPool ? "Manage Talent Pools (Saved)" : "Add to Talent Pool"}
            >
              <svg className="h-4 w-4" fill={isInAnyPool ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
          )}

          {inPoolView && onRemoveCandidateFromTalentPool && poolId && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemoveCandidateFromTalentPool(poolId, result.candidate_id); }}
              className="p-1.5 border border-rose-900/40 bg-rose-950/20 text-rose-400 hover:bg-rose-950/50 hover:border-rose-700 transition-all duration-200 rounded-none"
              title="Remove from Talent Pool"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}

          <div className="flex flex-col items-end">
            <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500">Fit Index</span>
            <span className={`inline-flex items-center px-2 py-1 rounded-none border font-mono text-base font-bold mt-1.5 shadow-sm ${getScoreColor(result.score)}`}>
              {formatScore(result.score)}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative group/score mt-4 bg-slate-950/20 border border-slate-900/60 rounded-none p-3 hover:bg-slate-900/10 transition-all duration-300"
      >
        <ScoreBar
          segments={[
            { label: "Skill Match", value: breakdown.skill_match, weight: 0.35, colorCode: "#10B981" },
            { label: "Career Fit", value: breakdown.career_fit, weight: 0.25, colorCode: "#3B82F6" },
            { label: "Signal Modifier", value: breakdown.signal_modifier, weight: 0.15, colorCode: "#6366F1" },
            { label: "Education", value: breakdown.education, weight: 0.15, colorCode: "#14B8A6" },
            { label: "Availability", value: breakdown.availability, weight: 0.10, colorCode: "#D97706" }
          ]}
        />
        <div className="grid grid-cols-5 text-[9px] text-slate-500 mt-2 font-mono gap-1">
          <span className="text-left truncate" title={`Skill Match: ${formatPercent(breakdown.skill_match)}`}>Skill: <strong className="text-[#10B981]">{formatPercent(breakdown.skill_match)}</strong></span>
          <span className="text-center truncate" title={`Career Fit: ${formatPercent(breakdown.career_fit)}`}>Career: <strong className="text-[#3B82F6]">{formatPercent(breakdown.career_fit)}</strong></span>
          <span className="text-center truncate" title={`Signal Modifier: ${formatPercent(breakdown.signal_modifier)}`}>Signal: <strong className="text-[#6366F1]">{formatPercent(breakdown.signal_modifier)}</strong></span>
          <span className="text-center truncate" title={`Education: ${formatPercent(breakdown.education)}`}>Edu: <strong className="text-[#14B8A6]">{formatPercent(breakdown.education)}</strong></span>
          <span className="text-right truncate" title={`Availability: ${formatPercent(breakdown.availability)}`}>Avail: <strong className="text-[#D97706]">{formatPercent(breakdown.availability)}</strong></span>
        </div>

        {/* Hover Tooltip Frame */}
        {showTooltip && (
          <div
            style={{
              position: "fixed",
              top: `${tooltipCoords.top}px`,
              left: `${tooltipCoords.left}px`,
              transform: tooltipCoords.placeBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)",
              zIndex: 9999,
            }}
            className="w-72 bg-[#1E222B] border border-slate-800 p-4 shadow-2xl rounded-none pointer-events-none font-mono text-[11px] text-slate-300"
          >
            <div className="border-b border-slate-800 pb-2 mb-2">
              <span className="text-xs font-bold text-slate-100">SCORE BREAKDOWN COMPOSITION</span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Skill Match (35%)", color: "#10B981", val: breakdown.skill_match * 0.35 },
                { label: "Career Fit (25%)", color: "#3B82F6", val: breakdown.career_fit * 0.25 },
                { label: "Signal Mod (15%)", color: "#6366F1", val: breakdown.signal_modifier * 0.15 },
                { label: "Education (15%)", color: "#14B8A6", val: breakdown.education * 0.15 },
                { label: "Availability (10%)", color: "#D97706", val: breakdown.availability * 0.10 },
              ].map(({ label, color, val }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: color }} />
                    {label}:
                  </span>
                  <strong style={{ color }}>{formatPercent(val)}</strong>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-2 mt-2 flex justify-between items-center font-bold text-slate-100">
              <span>Overall Fit Index:</span>
              <span className="text-emerald">{formatPercent(result.score)}</span>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs font-mono text-slate-400 bg-slate-950/40 border border-slate-900/80 rounded-none p-2.5 line-clamp-2 leading-relaxed">
        {reasoning}
      </p>

      {/* Skills chips — JD-matched highlighted in green */}
      {topSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {topSkills.map((skill) => {
            const matched = hasJdSkills && isSkillMatchedInJd(skill.name, jdSkillTokens);
            return (
              <span
                key={skill.name}
                title={matched ? `"${skill.name}" matches your JD` : skill.name}
                className={`text-[10px] font-mono px-2 py-0.5 border rounded-none transition-colors ${
                  matched
                    ? "bg-emerald/10 border-emerald/40 text-emerald"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                {matched && <span className="mr-0.5 text-emerald">✓</span>}
                {skill.name}
              </span>
            );
          })}
        </div>
      )}

      {anomaly && (
        <div className="mt-3 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber border border-amber/20 bg-amber/5 rounded-none p-2 shadow-sm animate-pulse">
          <svg className="h-4 w-4 shrink-0 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Employment history chronologies discrepancy detected.</span>
        </div>
      )}
    </div>
  );
};

export default CandidateCard;
