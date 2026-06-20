import { memo, useState } from "react";
import { formatPercent, formatNumber } from "../../utils/formatters";
import { SKILL_WEIGHT, CAREER_WEIGHT, SIGNAL_WEIGHT, EDUCATION_WEIGHT, AVAILABILITY_WEIGHT } from "../../constants/weights";

const CandidateModalReasoning = memo(({
  breakdown = {},
  candidate = {},
  jobDescription = "",
}) => {
  const profile = candidate.profile || {};
  const signals = candidate.redrob_signals || {};
  const skillScores = signals.skill_assessment_scores || {};
  const skills = candidate.skills || [];
  const education = candidate.education || [];

  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (sectionName) => {
    setOpenSection(openSection === sectionName ? null : sectionName);
  };

  const sections = [
    {
      id: "skill_match",
      label: "Skill Match Detail",
      score: breakdown.skill_match ?? 0,
      weight: SKILL_WEIGHT,
      color: "border-l-[#10B981]",
      badgeColor: "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/25",
      content: (
        <div className="space-y-3">
          <p className="text-slate-400">
            Skills Score calculates matches against JD skill keywords (if provided) and evaluates verified Redrob skill assessments.
          </p>
          <div className="bg-slate-950 p-3 border border-slate-900 rounded-none space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Skills Listed in Profile:</span>
              <span className="text-slate-200 font-bold">{skills.length} skills</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Skill Assessments Verified:</span>
              <span className="text-slate-200 font-bold">{Object.keys(skillScores).length} assessments</span>
            </div>
            {Object.keys(skillScores).length > 0 && (
              <div className="pt-2 border-t border-slate-900 space-y-1">
                <span className="text-[10px] text-slate-500 block">Assessment Scores:</span>
                {Object.entries(skillScores).map(([name, val]) => (
                  <div key={name} className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">{name}</span>
                    <span className="text-emerald font-bold">{val}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 border border-slate-900/50">
            <strong>Calculation Rule:</strong> If verified assessments exist, redrob score is 70% average of assessment metrics + 30% profile skill volume coverage. Otherwise, evaluates skill volume coverage up to 10 key skills.
          </div>
        </div>
      )
    },
    {
      id: "career_fit",
      label: "Career Fit & Narrative Detail",
      score: breakdown.career_fit ?? 0,
      weight: CAREER_WEIGHT,
      color: "border-l-[#3B82F6]",
      badgeColor: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/25",
      content: (
        <div className="space-y-3">
          <p className="text-slate-400">
            Career Fit assesses seniority matching based on stated years of experience and analyzes tenure/role diversity.
          </p>
          <div className="bg-slate-950 p-3 border border-slate-900 rounded-none space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Years of Experience:</span>
              <span className="text-slate-200 font-bold">{profile.years_of_experience ?? "0"} years</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Stated Career History Roles:</span>
              <span className="text-slate-200 font-bold">{candidate.career_history?.length || 0} positions</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Corporate Title:</span>
              <span className="text-slate-200 font-bold truncate max-w-[180px]">{profile.current_title || "—"}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 border border-slate-900/50">
            <strong>Calculation Rule:</strong> Experience duration matched against 15-year baseline (60% weight) + volume of roles to test career progression (40% weight).
          </div>
        </div>
      )
    },
    {
      id: "signal_modifier",
      label: "Signal Modifiers & Activity",
      score: breakdown.signal_modifier ?? 0,
      weight: SIGNAL_WEIGHT,
      color: "border-l-[#6366F1]",
      badgeColor: "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/25",
      content: (
        <div className="space-y-3">
          <p className="text-slate-400">
            Signal Modifier integrates verified activity metrics, responsiveness history, and profiling depth.
          </p>
          <div className="bg-slate-950 p-3 border border-slate-900 rounded-none space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Profile Completeness Score:</span>
              <span className="text-indigo-400 font-bold">{signals.profile_completeness_score ?? 0}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GitHub Activity Index:</span>
              <span className="text-slate-200 font-bold">{signals.github_activity_score === -1 ? "N/A" : `${signals.github_activity_score}/100`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recruiter Response Rate:</span>
              <span className="text-slate-200 font-bold">{formatPercent(signals.recruiter_response_rate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Interview Completion Rate:</span>
              <span className="text-slate-200 font-bold">{formatPercent(signals.interview_completion_rate)}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 border border-slate-900/50">
            <strong>Calculation Rule:</strong> Flat mean across 6 behavioral signals: completeness, github, responsiveness, completion rates, and assessment averages.
          </div>
        </div>
      )
    },
    {
      id: "education",
      label: "Education Tiering Prestige",
      score: breakdown.education ?? 0,
      weight: EDUCATION_WEIGHT,
      color: "border-l-[#14B8A6]",
      badgeColor: "bg-[#14B8A6]/10 text-[#14B8A6] border-[#14B8A6]/25",
      content: (
        <div className="space-y-3">
          <p className="text-slate-400">
            Education evaluates institution prestige (Tiers 1-4), field compatibility (STEM relevance), and degree level.
          </p>
          <div className="bg-slate-950 p-3 border border-slate-900 rounded-none space-y-2">
            {education.length === 0 ? (
              <p className="text-slate-500 italic text-[11px]">No academic credentials registered</p>
            ) : (
              education.map((edu, idx) => (
                <div key={idx} className="border-b border-slate-900 last:border-b-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0 space-y-1">
                  <div className="flex justify-between font-bold text-[11px] text-slate-200">
                    <span className="truncate max-w-[200px]">{edu.institution}</span>
                    <span className="text-[#14B8A6] uppercase">{edu.tier || "unknown tier"}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{edu.degree || "—"} in {edu.field_of_study || "—"}</span>
                    <span>Grad: {edu.end_year || "—"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 border border-slate-900/50">
            <strong>Calculation Rule:</strong> Multiplier scoring: `Institution Tier Weight * CS Field Compatibility * Degree Type Weight`.
          </div>
        </div>
      )
    },
    {
      id: "availability",
      label: "Operational Availability Detail",
      score: breakdown.availability ?? 0,
      weight: AVAILABILITY_WEIGHT,
      color: "border-l-[#D97706]",
      badgeColor: "bg-[#D97706]/10 text-[#D97706] border-[#D97706]/25",
      content: (
        <div className="space-y-3">
          <p className="text-slate-400">
            Availability tracks immediate operational status, relocation willingness, notice timelines, and work modes.
          </p>
          <div className="bg-slate-950 p-3 border border-slate-900 rounded-none space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Notice Period Days:</span>
              <span className={`font-bold ${signals.notice_period_days <= 30 ? "text-emerald" : "text-slate-200"}`}>{signals.notice_period_days ?? "--"} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Open to Work:</span>
              <span className="text-slate-200 font-bold">{signals.open_to_work_flag ? "YES" : "NO"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Willing to Relocate:</span>
              <span className="text-slate-200 font-bold">{signals.willing_to_relocate ? "YES" : "NO"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Work Mode Choice:</span>
              <span className="text-slate-200 font-bold capitalize">{signals.preferred_work_mode || "—"}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 border border-slate-900/50">
            <strong>Calculation Rule:</strong> Flat mean across `Open to Work` (50% default / 100% active), `Notice period score` (linear penalty up to 180 days), and `Relocation index`.
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="border border-slate-900 bg-slate-950/20 p-5 rounded-none font-mono text-xs">
      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-slate-900 pb-3 mb-4">
        Multi-Dimensional Reasoning Trace
      </h4>
      <div className="space-y-3">
        {sections.map((sect) => {
          const isOpen = openSection === sect.id;
          return (
            <div key={sect.id} className={`border border-slate-900 bg-slate-950/60 rounded-none overflow-hidden transition-all duration-200 border-l-4 ${sect.color}`}>
              <button
                type="button"
                onClick={() => toggleSection(sect.id)}
                className="w-full px-4 py-3 flex justify-between items-center text-left focus:outline-none focus:bg-slate-900/20 hover:bg-slate-900/10 transition-colors"
              >
                <span className="text-slate-300 font-semibold text-xs uppercase tracking-wide">{sect.label}</span>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 border text-[9px] font-bold tracking-widest uppercase rounded-none ${sect.badgeColor}`}>
                    Score: {formatPercent(sect.score)} (w: {sect.weight * 100}%)
                  </span>
                  <span className="text-slate-500 text-[10px]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-900/50 text-[11px] leading-relaxed text-slate-400 mt-1">
                  {sect.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

CandidateModalReasoning.displayName = "CandidateModalReasoning";

export default CandidateModalReasoning;
