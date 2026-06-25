import { memo } from "react";
import ScoreBar from "./ScoreBar";
import { detectTimelineAnomaly, deriveBreakdown, deriveReasoning } from "../utils/scoreUtils";
import { formatScore, formatPercent } from "../utils/formatters";
import { extractJdSkills, isSkillMatchedInJd } from "../utils/jdUtils";
import { CheckIcon } from "./icons";

const CandidateCard = memo(({
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
  filteredRank,
}) => {
  const profile = candidate?.profile || {};
  const breakdown = deriveBreakdown(result, candidate);
  const reasoning = deriveReasoning(result, candidate);
  const anomaly = detectTimelineAnomaly(candidate);
  const topSkills = (candidate?.skills || []).slice(0, 5);

  // Extract JD skill tokens for matching
  const jdSkillTokens = extractJdSkills(jobDescription);
  const hasJdSkills = jdSkillTokens.length > 0;

  // Count matched JD skills for this candidate
  const matchedSkillCount = hasJdSkills
    ? topSkills.filter((s) => isSkillMatchedInJd(s.name, jdSkillTokens)).length
    : 0;

  const getScoreColor = (score) => {
    const val = score <= 1 ? score * 100 : score;
    if (val >= 80) return "text-emerald border-emerald/20 bg-emerald/5";
    if (val >= 60) return "text-cobalt border-cobalt/20 bg-cobalt/5";
    return "text-slate-400 border-slate-800 bg-slate-900/40";
  };

  const isInAnyPool = talentPools.some((p) =>
    p.candidates.some((c) => c.candidate_id === result.candidate_id)
  );

  // Suspicious Profile badge logical contradiction checks
  const yearsExp = profile.years_of_experience || 0;
  const skillsCount = candidate?.skills?.length || 0;
  const completenessScore = candidate?.redrob_signals?.profile_completeness_score || 0;
  const isSuspicious = yearsExp > 30 || skillsCount === 0 || completenessScore < 20;

  // Rank Delta Indicator calculation
  const originalRank = typeof result.rank === 'number' ? result.rank : parseInt(result.rank, 10);
  const delta = !isNaN(originalRank) && typeof filteredRank === 'number' ? originalRank - filteredRank : 0;

  // Missing required JD skills calculation
  const candidateSkillNamesLower = new Set((candidate?.skills || []).map(s => String(s.name || "").toLowerCase()));
  const missingJdSkills = jdSkillTokens.filter(token => {
    const tokenLower = token.toLowerCase();
    for (const name of candidateSkillNamesLower) {
      if (name.includes(tokenLower) || tokenLower.includes(name)) {
        return false;
      }
    }
    return true;
  });

  // Top 3 matched skills for the hover snapshot
  const matchedSkillNames = hasJdSkills
    ? topSkills.filter((s) => isSkillMatchedInJd(s.name, jdSkillTokens)).map(s => s.name)
    : [];
  const skillMatchTooltip = matchedSkillNames.length > 0
    ? `Top Matches: ${matchedSkillNames.slice(0, 3).join(", ")}`
    : "No JD skills matched";

  return (
    <div
      onClick={onSelect}
      className={`w-full text-left px-6 py-5 hover:bg-slate-900/30 border-l-2 active:scale-[0.995] active:bg-slate-900/40 transition-all duration-150 ease-in-out bg-canvas rounded-none cursor-pointer ${
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
                role="checkbox"
                aria-checked={isCompareSelected}
                aria-label={`Select ${profile.anonymized_name || "candidate"} for comparison`}
                onClick={(e) => { e.stopPropagation(); onToggleCompare(result.candidate_id); }}
                title={isCompareSelected ? "Deselect from comparison" : "Select for comparison"}
                className={`h-4 w-4 shrink-0 border transition-all duration-200 flex items-center justify-center rounded-none ${
                  isCompareSelected
                    ? "border-amber bg-amber/20 text-amber"
                    : "border-slate-700 bg-slate-950 text-transparent hover:border-slate-500"
                }`}
              >
                {isCompareSelected && (
                  <CheckIcon className="h-2.5 w-2.5 text-amber shrink-0" />
                )}
              </button>
            )}
            <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-none bg-slate-900 border border-slate-800 text-[10px] font-bold font-mono text-slate-400">
              #{result.rank}
            </span>
            {delta !== 0 && (
              <span
                className={`inline-flex items-center justify-center h-5 px-1.5 font-mono text-[9px] font-bold border rounded-none ${
                  delta > 0
                    ? "bg-emerald/10 border-emerald/20 text-emerald"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}
                title={`Rank change: ${delta > 0 ? `up by ${delta}` : `down by ${Math.abs(delta)}`} positions in filtered view`}
              >
                {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
              </span>
            )}
            <h3 className="text-base font-semibold text-slate-100 group-hover:text-emerald transition-colors duration-200">
              {profile.anonymized_name || "Unknown Candidate"}
            </h3>
            <span className="text-[10px] text-slate-600 font-mono">
              {result.candidate_id}
            </span>
            {/* JD skill match indicator badge */}
            {hasJdSkills && matchedSkillCount > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald/10 border border-emerald/30 text-emerald text-[9px] font-mono rounded-none">
                <CheckIcon className="h-2.5 w-2.5 shrink-0" />
                {matchedSkillCount} JD match{matchedSkillCount !== 1 ? "es" : ""}
              </span>
            )}
            {/* Data Quality Score badge */}
            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[9px] font-mono rounded-none" title="Profile completeness quality score">
              DQ: {completenessScore}%
            </span>
            {/* Suspicious Profile alert badge */}
            {isSuspicious && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[9px] font-mono font-bold rounded-none animate-pulse" title="Logical anomalies or low data quality constraints flagged">
                ⚠ Suspicious Profile
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

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[9px] uppercase font-mono tracking-widest text-slate-500">Fit Index</span>
          <span
            className={`inline-flex items-center px-3 py-1.5 rounded-none border-2 font-mono text-xl font-bold shadow-lg ${getScoreColor(result.score)}`}
            style={{
              boxShadow: result.score >= 0.8
                ? '0 0 16px rgba(16,185,129,0.25)'
                : result.score >= 0.6
                ? '0 0 12px rgba(59,130,246,0.2)'
                : 'none',
            }}
          >
            {formatScore(result.score)}
          </span>
        </div>
        </div>
      </div>

      {/* ═══ ANALYSIS PANEL — the main result ═══ */}
      <div
        className="relative mt-4 rounded-none border border-slate-700/60 bg-slate-950/60 overflow-visible group"
        style={{
          borderLeft: '3px solid rgba(16,185,129,0.5)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.3), inset 0 0 40px rgba(16,185,129,0.02)',
        }}
      >
        {/* Section header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800/60">
          <span className="text-[9px] uppercase tracking-[0.25em] font-mono font-bold text-slate-500">
            Score Breakdown
          </span>
          <span className="text-[9px] font-mono text-slate-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald/60 animate-pulse inline-block" />
            hover for weighted contribution
          </span>
        </div>

        {/* Bars */}
        <div className="px-4 py-3">
          <ScoreBar
            segments={[
              { label: "Skill Match", value: breakdown.skill_match, weight: 0.35, colorCode: "#10B981", tooltipContent: skillMatchTooltip },
              { label: "Career Fit", value: breakdown.career_fit, weight: 0.25, colorCode: "#3B82F6" },
              { label: "Signal Mod.", value: breakdown.signal_modifier, weight: 0.15, colorCode: "#6366F1" },
              { label: "Education", value: breakdown.education, weight: 0.15, colorCode: "#14B8A6" },
              { label: "Availability", value: breakdown.availability, weight: 0.10, colorCode: "#D97706" }
            ]}
          />
        </div>

        {/* Hover Tooltip Frame (CSS-only) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none w-72 p-4 shadow-2xl rounded-none font-mono text-[11px] bg-slate-950 border border-slate-800 text-slate-300">
          <div className="pb-2 mb-2 border-b border-slate-800">
            <span className="text-slate-100 text-xs font-bold uppercase">SCORE BREAKDOWN COMPOSITION</span>
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
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: color }} />
                  {label}:
                </span>
                <strong style={{ color }}>{formatPercent(val)}</strong>
              </div>
            ))}
          </div>
          <div className="pt-2 mt-2 border-t border-slate-800 text-slate-100 flex justify-between items-center font-bold">
            <span>Overall Fit Index:</span>
            <span className="text-emerald">{formatPercent(result.score)}</span>
          </div>
        </div>
      </div>

      {/* Reasoning text — bigger and more visible */}
      <p className="mt-3 text-[11px] font-mono text-slate-300 bg-slate-950/60 border border-slate-800/70 rounded-none px-4 py-3 leading-relaxed italic">
        {reasoning}
      </p>

      {/* Skills chips — JD-matched highlighted in green, missing in strikethrough */}
      {(topSkills.length > 0 || (hasJdSkills && missingJdSkills.length > 0)) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topSkills.map((skill) => {
            const matched = hasJdSkills && isSkillMatchedInJd(skill.name, jdSkillTokens);
            return (
              <span
                key={skill.name}
                title={matched ? `"${skill.name}" matches your JD` : skill.name}
                className={`text-[10px] font-mono px-2.5 py-1 border rounded-none transition-colors font-semibold inline-flex items-center gap-1 ${
                  matched
                    ? "bg-emerald/10 border-emerald/40 text-emerald"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                {matched && <CheckIcon className="h-2.5 w-2.5 shrink-0" />}
                <span>{skill.name}</span>
              </span>
            );
          })}
          {hasJdSkills && missingJdSkills.slice(0, 3).map((skillName) => (
            <span
              key={skillName}
              title={`Required skill "${skillName}" is missing from profile`}
              className="text-[10px] font-mono px-2.5 py-1 border border-slate-900 bg-slate-950/40 text-slate-500 line-through rounded-none inline-flex items-center gap-1 select-none"
            >
              <span>{skillName}</span>
            </span>
          ))}
        </div>
      )}

      {anomaly && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber border border-amber/20 bg-amber/5 rounded-none p-2 shadow-sm"
          style={{ animation: "pulse 2s ease-in-out 2" }}
        >
          <svg className="h-4 w-4 shrink-0 text-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Employment history chronologies discrepancy detected.</span>
        </div>
      )}
    </div>
  );
});

CandidateCard.displayName = "CandidateCard";

export default CandidateCard;
