import { formatDate, formatNumber, formatPercent, formatScore } from "../utils/formatters";
import { deriveBreakdown, deriveReasoning } from "../utils/scoreUtils";
import { extractJdSkills, isSkillMatchedInJd, getMissingSkills } from "../utils/jdUtils";

const formatBool = (value) => {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "--";
};

const formatRange = (range) => {
  if (!range) return "--";
  return `${formatNumber(range.min, 1)} - ${formatNumber(range.max, 1)} LPA`;
};

const getCompanyCategory = (industry) => {
  if (!industry) return "Unknown";
  return industry.toLowerCase().includes("it") ? "IT Services" : "Product";
};

const ProgressBar = ({ value, color }) => {
  const width = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="h-1 w-full bg-slate-900 mt-1">
      <div className={`h-1 ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
};

const getRoleAnomaly = (role, index, career) => {
  const start = role.start_date;
  const end = role.end_date || new Date().toISOString();
  const duration = Number(role.duration_months || 0);

  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    const computed = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    if (Math.abs(computed - duration) > 3) {
      return `Duration mismatch (reported ${duration}m, computed ${computed}m)`;
    }
    if (computed < 0) {
      return "Negative duration (invalid date order)";
    }
  }

  const currentInterval = { start: new Date(start), end: new Date(end) };
  for (let i = 0; i < career.length; i++) {
    if (i === index) continue;
    const other = career[i];
    const otherStart = other.start_date;
    const otherEnd = other.end_date || new Date().toISOString();
    if (!otherStart || !otherEnd) continue;
    const otherInterval = { start: new Date(otherStart), end: new Date(otherEnd) };
    if (currentInterval.start < otherInterval.end && otherInterval.start < currentInterval.end) {
      return `Overlaps with role: ${other.title} at ${other.company}`;
    }
  }

  return null;
};

const getEducationScore = (eduList) => {
  if (!eduList || !eduList.length) return 0.2;
  const tierWeights = { tier_1: 1.0, tier_2: 0.8, tier_3: 0.6, tier_4: 0.4 };
  let maxScore = 0.2;
  eduList.forEach(edu => {
    const tier = String(edu.tier).toLowerCase();
    if (tierWeights[tier] > maxScore) {
      maxScore = tierWeights[tier];
    }
  });
  return maxScore;
};

const getAvailabilityScore = (signals) => {
  const notice = signals.notice_period_days;
  if (notice == null) return 0.5;
  if (notice <= 15) return 1.0;
  if (notice <= 30) return 0.85;
  if (notice <= 60) return 0.60;
  if (notice <= 90) return 0.30;
  return 0.10;
};

const parseReasoning = (reasonText) => {
  if (!reasonText) return null;
  const parts = reasonText.split(";").map(s => s.trim());
  let title = "";
  let experience = "";
  let skillsCount = "";
  let responseVelocity = "";

  if (parts.length >= 1) {
    const firstPart = parts[0];
    const withIdx = firstPart.lastIndexOf(" with ");
    if (withIdx !== -1) {
      title = firstPart.slice(0, withIdx).trim();
      experience = firstPart.slice(withIdx + 6).trim();
    } else {
      title = firstPart;
    }
  }
  if (parts.length >= 2) {
    skillsCount = parts[1];
  }
  if (parts.length >= 3) {
    responseVelocity = parts[2].replace(/\.$/, "");
  }

  return { title, experience, skillsCount, responseVelocity };
};

const CandidateModal = ({
  candidate,
  result,
  onClose,
  talentPools = [],
  onOpenPoolManager,
  jobDescription = "",
}) => {
  const profile = candidate.profile || {};
  const signals = candidate.redrob_signals || {};
  const breakdown = deriveBreakdown(result, candidate);
  const reasoning = deriveReasoning(result, candidate);
  const skillScores = signals.skill_assessment_scores || {};
  const skills = candidate.skills || [];

  // JD skill gap analysis
  const jdSkillTokens = extractJdSkills(jobDescription);
  const hasJd = jdSkillTokens.length > 0;
  // Top 15 JD tokens as "required" (heuristic — those > 3 chars likely skills)
  const jdRequiredSkills = jdSkillTokens.filter((t) => t.length > 3).slice(0, 15);
  const missingSkills = hasJd ? getMissingSkills(jdRequiredSkills, skills) : [];
  const matchedJdSkills = hasJd
    ? jdRequiredSkills.filter((jdSkill) =>
        skills.some((s) => isSkillMatchedInJd(s.name, [jdSkill]))
      )
    : [];
  const coveragePct = jdRequiredSkills.length > 0
    ? Math.round((matchedJdSkills.length / jdRequiredSkills.length) * 100)
    : null;

  const isInAnyPool = talentPools.some((p) =>
    p.candidates.some((c) => c.candidate_id === candidate.candidate_id)
  );

  const skillRows = skills.map((skill) => ({
    name: skill.name,
    proficiency: skill.proficiency,
    assessment: skillScores[skill.name],
    duration: skill.duration_months,
  }));

  Object.keys(skillScores).forEach((name) => {
    if (!skillRows.find((row) => row.name === name)) {
      skillRows.push({
        name,
        proficiency: "--",
        assessment: skillScores[name],
        duration: "--",
      });
    }
  });

  const getProficiencyStyle = (prof) => {
    const p = String(prof).toLowerCase();
    if (p === "expert") return "bg-emerald/10 text-emerald border-emerald/20";
    if (p === "advanced") return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    if (p === "intermediate") return "bg-cobalt/10 text-cobalt border-cobalt/20";
    if (p === "beginner") return "bg-slate-800 text-slate-400 border-slate-700";
    return "bg-slate-900 text-slate-500 border-slate-800";
  };

  const skillMatch = breakdown.skill_match;
  const careerFit = breakdown.career_fit;
  const signalModifier = breakdown.signal_modifier;
  const educationScore = breakdown.education;
  const availabilityScore = breakdown.availability;

  // Honeypot Shield: High-Risk Logical Contradiction Detection
  const isSuspiciousProfile = (
    (profile.years_of_experience ?? 0) > 30 ||
    skills.length === 0 ||
    (signals.profile_completeness_score ?? 100) < 20
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
      <div className="h-full w-full max-w-5xl bg-slate-950 border-l border-slate-900 shadow-2xl flex flex-col animate-slide-in rounded-none">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-900 bg-slate-950">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-mono">Profile Explorer</p>
            <h3 className="text-xl font-bold text-white mt-1">{profile.anonymized_name}</h3>
            <p className="text-xs text-slate-400 mt-1 font-mono">{profile.headline}</p>
          </div>
          <div className="flex items-center gap-3">
            {onOpenPoolManager && (
              <button
                type="button"
                onClick={(e) => onOpenPoolManager(candidate, result, e)}
                className={`px-4 py-2 text-xs uppercase tracking-wider font-mono border transition-all duration-200 rounded-none flex items-center gap-2 ${
                  isInAnyPool
                    ? "border-emerald/40 bg-emerald/10 text-emerald hover:bg-emerald/20"
                    : "border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <svg className="h-3.5 w-3.5" fill={isInAnyPool ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>{isInAnyPool ? "In Talent Pool" : "Add to Pool"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs uppercase tracking-wider font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-none transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>

        {/* Honeypot Shield: Suspicious Profile Warning Banner */}
        {isSuspiciousProfile && (
          <div className="bg-amber-950/40 border border-amber-600 text-amber-500 font-mono text-xs px-3 py-1.5 uppercase tracking-wider flex items-center gap-2 shrink-0">
            <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            ⚠️ Suspicious Profile: High-Risk Logical Contradictions Flagged
          </div>
        )}

        {/* Five-Dimensional Component Score Breakdown & Weight Alignment */}
        <div className="px-6 py-4 border-b border-slate-900 bg-slate-950/60">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center flex-wrap gap-x-4 gap-y-2 text-xs font-mono">
              <span className="text-slate-400 mr-2">OVERALL FIT INDEX: <strong className="text-emerald text-sm">{formatScore(result?.score)}</strong></span>
              <span className="text-slate-500">Skill Match (35%): <strong className="text-[#10B981]">{formatPercent(skillMatch)}</strong></span>
              <span className="text-slate-500">Career Fit (25%): <strong className="text-[#3B82F6]">{formatPercent(careerFit)}</strong></span>
              <span className="text-slate-500">Signal Mod (15%): <strong className="text-[#6366F1]">{formatPercent(signalModifier)}</strong></span>
              <span className="text-slate-500">Education (15%): <strong className="text-[#14B8A6]">{formatPercent(educationScore)}</strong></span>
              <span className="text-slate-500">Availability (10%): <strong className="text-[#D97706]">{formatPercent(availabilityScore)}</strong></span>
            </div>
            
            {/* Embedded Visual Score Breakdown Chart */}
            <div className="h-2.5 w-full bg-slate-900 overflow-hidden flex border border-slate-900 mt-1 rounded-none">
              <div className="h-full bg-[#10B981]" style={{ width: `${skillMatch * 35}%` }} title={`Skill Match Layer (skill_match, weight: 35%): ${formatPercent(skillMatch)}`} />
              <div className="h-full bg-[#3B82F6]" style={{ width: `${careerFit * 25}%` }} title={`Career Narrative fit (career_fit, weight: 25%): ${formatPercent(careerFit)}`} />
              <div className="h-full bg-[#6366F1]" style={{ width: `${signalModifier * 15}%` }} title={`Activity Signals Modifier (signal_modifier, weight: 15%): ${formatPercent(signalModifier)}`} />
              <div className="h-full bg-[#14B8A6]" style={{ width: `${educationScore * 15}%` }} title={`Institutional Prestige (education, weight: 15%): ${formatPercent(educationScore)}`} />
              <div className="h-full bg-[#D97706]" style={{ width: `${availabilityScore * 10}%` }} title={`Immediate Availability (availability, weight: 10%): ${formatPercent(availabilityScore)}`} />
            </div>

            {/* Dedicated Metric Visualization Grid Row for Hidden Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-900 text-xs font-mono">
              {/* Institutional Prestige Section (education - 15%) */}
              <div className="bg-slate-950 border border-slate-900 p-3 rounded-none">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5 mb-2">
                  <span className="text-[#14B8A6] font-bold uppercase tracking-wider">Education Analysis (15% Weight)</span>
                  <span className="text-slate-400 font-bold">Score: {formatPercent(educationScore)}</span>
                </div>
                <div className="space-y-1.5 max-h-[72px] overflow-y-auto pr-1 custom-scrollbar">
                  {(!candidate.education || candidate.education.length === 0) ? (
                    <span className="text-slate-500 italic text-[11px]">No academic qualifications registered</span>
                  ) : (
                    candidate.education.map((edu, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-2 text-[11px]">
                        <span className="text-slate-300 truncate">
                          {edu.degree || "Degree"} in {edu.field_of_study || "Field"}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-[#14B8A6] text-[9px] font-bold rounded-none shrink-0 uppercase">
                          {edu.tier || "unknown"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Operational Availability Node (availability - 10%) */}
              <div className="bg-slate-950 border border-slate-900 p-3 rounded-none">
                <div className="flex justify-between items-center border-b border-slate-900 pb-1.5 mb-2">
                  <span className="text-[#D97706] font-bold uppercase tracking-wider">Availability & Signals (10% Weight)</span>
                  <span className="text-slate-400 font-bold">Score: {formatPercent(availabilityScore)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Notice Period:</span>
                    <span className={`font-bold ${signals.notice_period_days <= 30 ? "text-emerald animate-pulse" : "text-slate-300"}`}>
                      {signals.notice_period_days ?? "--"} days
                      {signals.notice_period_days <= 30 && " (Immediate)"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Open to Work:</span>
                    <span className="text-slate-300 font-bold">{signals.open_to_work_flag ? "YES" : "NO"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Relocatable:</span>
                    <span className="text-slate-300 font-bold">{signals.willing_to_relocate ? "YES" : "NO"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Salary:</span>
                    <span className="text-slate-300 font-bold">{formatRange(signals.expected_salary_range_inr_lpa)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Reasoning Field Ingestion & Structured Badge Parsing */}
          <div className="border border-slate-900 bg-slate-950/40 p-4 shadow-sm rounded-none">
            <h4 className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-3">Automated Reasoning Synthesizer</h4>
            {(() => {
              const parsed = parseReasoning(reasoning);
              if (!parsed) {
                return (
                  <p className="text-xs font-mono text-slate-400 italic">No reasoning metrics registered.</p>
                );
              }
              return (
                <div className="flex flex-wrap gap-2">
                  {parsed.title && (
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs rounded-none">
                      Current Title: {parsed.title}
                    </span>
                  )}
                  {parsed.skillsCount && (
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs rounded-none">
                      Core Skills Count: {parsed.skillsCount}
                    </span>
                  )}
                  {parsed.responseVelocity && (
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs rounded-none">
                      Stated Response Velocity: {parsed.responseVelocity}
                    </span>
                  )}
                  {parsed.experience && (
                    <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs rounded-none">
                      Total Years of Experience: {parsed.experience}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="border border-slate-900 bg-slate-900/10 p-5 flex flex-col rounded-none">
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-900 pb-3 mb-4">
                Employment Timeline Trace
              </h4>
              {(!candidate.career_history || candidate.career_history.length === 0) ? (
                <div className="flex-1 flex items-center justify-center py-12 text-center">
                  <p className="text-xs font-mono text-slate-600">
                    No historical career timelines recorded in this profile registry.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 border-l border-slate-800 space-y-6 flex-1">
                  {candidate.career_history.map((role, index) => {
                    const roleAnomaly = getRoleAnomaly(role, index, candidate.career_history || []);
                    return (
                      <div key={`${role.company}-${index}`} className="relative group">
                        {/* High-tech square timeline marker */}
                        <div className={`absolute -left-[30px] top-1.5 h-3 w-3 border-2 bg-slate-950 transition-all duration-300 rounded-none ${
                          roleAnomaly 
                            ? "border-amber shadow-[0_0_8px_rgba(217,119,6,0.3)] animate-pulse" 
                            : "border-slate-700 group-hover:border-emerald"
                        }`} />
                        
                        <div className={`p-3.5 border transition-all duration-300 rounded-none ${
                          roleAnomaly 
                            ? "bg-amber/5 border-amber/25 shadow-sm shadow-amber-500/5" 
                            : "bg-slate-950/60 border-slate-900 group-hover:border-slate-800"
                        }`}>
                          <div className="flex justify-between items-start flex-wrap gap-1">
                            <h5 className="text-xs font-semibold text-slate-100 font-mono">{role.title}</h5>
                            <span className="text-[10px] font-mono text-slate-500">
                              {formatDate(role.start_date)} - {role.end_date ? formatDate(role.end_date) : "Present"}
                            </span>
                          </div>
                          <p className="text-xs text-emerald mt-0.5 font-mono">{role.company}</p>
                          <p className="text-[10px] text-slate-500 mt-1 font-mono">
                            {role.industry} · {getCompanyCategory(role.industry)} · {role.company_size} emp
                          </p>
                          {role.description && (
                            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed italic border-t border-slate-900 pt-2 font-mono">
                              &ldquo;{role.description}&rdquo;
                            </p>
                          )}
                          {roleAnomaly && (
                            <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-mono text-amber border border-amber/20 bg-amber/10 p-1.5 animate-pulse rounded-none">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>{roleAnomaly}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="border border-slate-900 bg-slate-900/10 p-5 rounded-none">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-900 pb-3 mb-4">
                  Skills Assessment Ledger
                </h4>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-12 text-[10px] uppercase font-mono tracking-wider text-slate-500 border-b border-slate-900 pb-2">
                    <span className="col-span-5">Skill Name</span>
                    <span className="col-span-4 text-center">Declared Prof.</span>
                    <span className="col-span-3 text-right">Assessed Score</span>
                  </div>
                  <div className="space-y-2.5 max-h-[185px] overflow-y-auto pr-1 custom-scrollbar">
                    {skillRows.length === 0 && <p className="text-slate-500 text-xs italic font-mono">No skills catalogued.</p>}
                    {skillRows.map((skill) => (
                      <div key={skill.name} className="grid grid-cols-12 items-center text-xs border-b border-slate-900/30 pb-2 font-mono">
                        <span className="col-span-5 font-semibold text-slate-200">{skill.name}</span>
                        <span className="col-span-4 text-center">
                          <span className={`inline-flex px-2 py-0.5 border text-[9px] font-mono capitalize rounded-none ${getProficiencyStyle(skill.proficiency)}`}>
                            {skill.proficiency || "--"}
                          </span>
                        </span>
                        <span className="col-span-3 text-right font-mono font-bold text-emerald">
                          {skill.assessment != null ? `${formatNumber(skill.assessment, 0)}%` : "--"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Education Metrics Profile Block */}
              <div className="border border-slate-900 bg-slate-900/10 p-5 rounded-none">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-900 pb-3 mb-4">
                  Institutional Profiles & Qualifications Matrix
                </h4>
                <div className="space-y-3.5">
                  <div className="grid grid-cols-12 text-[10px] uppercase font-mono tracking-wider text-slate-500 border-b border-slate-900 pb-2">
                    <span className="col-span-3">Degree Level</span>
                    <span className="col-span-3">Field of Study</span>
                    <span className="col-span-3">Institution</span>
                    <span className="col-span-1 text-center">Grad</span>
                    <span className="col-span-2 text-right">Prestige</span>
                  </div>
                  <div className="space-y-2.5 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                    {(!candidate.education || candidate.education.length === 0) ? (
                      <p className="text-slate-500 text-xs italic font-mono">No education metrics registered.</p>
                    ) : (
                      candidate.education.map((edu, idx) => (
                        <div key={idx} className="grid grid-cols-12 items-center text-xs border-b border-slate-900/30 pb-2 font-mono">
                          <span className="col-span-3 text-slate-200">{edu.degree || "--"}</span>
                          <span className="col-span-3 text-slate-400">{edu.field_of_study || "--"}</span>
                          <span className="col-span-3 text-slate-400">{edu.institution || "--"}</span>
                          <span className="col-span-1 text-center text-slate-500">{edu.end_year || "--"}</span>
                          <span className="col-span-2 text-right font-bold text-indigo-400">
                            {edu.tier || "unknown"}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Skill Gap Analysis Section */}
              {hasJd && (
                <div className="border border-slate-900 bg-slate-900/10 p-5 rounded-none">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      JD Skill Gap Analysis
                    </h4>
                    {coveragePct !== null && (
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 border rounded-none ${
                        coveragePct >= 70 ? "bg-emerald/10 border-emerald/30 text-emerald" :
                        coveragePct >= 40 ? "bg-cobalt/10 border-cobalt/30 text-cobalt" :
                        "bg-rose-900/20 border-rose-800/40 text-rose-400"
                      }`}>
                        {coveragePct}% coverage
                      </span>
                    )}
                  </div>

                  {matchedJdSkills.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] uppercase tracking-wider text-emerald font-mono mb-2 font-bold">✓ Matched JD Skills</p>
                      <div className="flex flex-wrap gap-1">
                        {matchedJdSkills.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-emerald/10 text-emerald text-[10px] rounded-none border border-emerald/30 font-mono">
                            ✓ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {missingSkills.length > 0 ? (
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-rose-400 font-mono mb-2 font-bold">✗ Missing / Skill Gaps</p>
                      <div className="flex flex-wrap gap-1">
                        {missingSkills.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-red-900/20 text-rose-400 text-[10px] rounded-none border border-red-800/30 font-mono">
                            ✗ {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs font-mono text-emerald italic">
                      No skill gaps detected — candidate covers all extracted JD requirements.
                    </p>
                  )}

                  {!hasJd && (
                    <p className="text-xs font-mono text-slate-500 italic">
                      Paste a Job Description in the input panel to enable gap analysis.
                    </p>
                  )}
                </div>
              )}

              <div className="border border-slate-900 bg-slate-900/10 p-5 rounded-none">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-900 pb-3 mb-4">
                  Behavioral Signal Matrix
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-400">
                  <div className="border border-slate-900 bg-slate-950 p-3 space-y-2 shadow-inner rounded-none">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-900 pb-1 mb-2 font-bold font-mono">Availability & Compensation</p>
                    <div className="flex justify-between">
                      <span>Notice Period:</span>
                      <span className={signals.notice_period_days <= 30 ? "text-emerald font-bold" : "text-slate-300"}>{signals.notice_period_days ?? "--"} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salary Expected:</span>
                      <span className="text-slate-300 font-semibold">{formatRange(signals.expected_salary_range_inr_lpa)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Work Mode:</span>
                      <span className="text-slate-300 capitalize">{signals.preferred_work_mode ?? "--"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Open To Work:</span>
                      <span className="text-slate-300">{formatBool(signals.open_to_work_flag)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Relocation:</span>
                      <span className="text-slate-300">{formatBool(signals.willing_to_relocate)}</span>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-950 p-3 space-y-2.5 shadow-inner rounded-none">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-900 pb-1 mb-2 font-bold font-mono">Engagement Scores</p>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Recruiter Response:</span>
                        <span className="text-emerald font-bold">{formatPercent(signals.recruiter_response_rate)}</span>
                      </div>
                      <ProgressBar value={signals.recruiter_response_rate || 0} color="bg-emerald" />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Interview Complete:</span>
                        <span className="text-cobalt font-bold">{formatPercent(signals.interview_completion_rate)}</span>
                      </div>
                      <ProgressBar value={signals.interview_completion_rate || 0} color="bg-cobalt" />
                    </div>
                    {/* Offer Acceptance Rate dedicated row */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span>Offer Acceptance:</span>
                        <span className={signals.offer_acceptance_rate === -1 ? "text-slate-600 italic font-normal" : "text-emerald font-bold"}>
                          {signals.offer_acceptance_rate === -1 ? "No Prior Offer Transactions Recorded" : formatPercent(signals.offer_acceptance_rate)}
                        </span>
                      </div>
                      {signals.offer_acceptance_rate !== -1 && (
                        <ProgressBar value={signals.offer_acceptance_rate || 0} color="bg-emerald" />
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span>Avg Response Time:</span>
                      <span className="text-slate-300 font-semibold">{formatNumber(signals.avg_response_time_hours, 1)} hrs</span>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-950 p-3 space-y-2 shadow-inner rounded-none">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-900 pb-1 mb-2 font-bold font-mono">Verification Checklist</p>
                    <div className="flex justify-between">
                      <span>Email Verified:</span>
                      <span className={signals.verified_email ? "text-emerald" : "text-slate-600"}>{formatBool(signals.verified_email)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Phone Verified:</span>
                      <span className={signals.verified_phone ? "text-emerald" : "text-slate-600"}>{formatBool(signals.verified_phone)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>LinkedIn Connected:</span>
                      <span className={signals.linkedin_connected ? "text-cobalt" : "text-slate-600"}>{formatBool(signals.linkedin_connected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GitHub Connected:</span>
                      <span className={signals.github_activity_score !== -1 ? "text-indigo-400" : "text-slate-600"}>
                        {signals.github_activity_score !== -1 ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="border border-slate-900 bg-slate-950 p-3 space-y-2 shadow-inner rounded-none">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-900 pb-1 mb-2 font-bold font-mono">Activity Signals (30d)</p>
                    <div className="flex justify-between">
                      <span>Profile Completeness:</span>
                      <span className="text-slate-300 font-bold">{formatNumber(signals.profile_completeness_score, 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Profile Views:</span>
                      <span className="text-slate-300 font-semibold">{signals.profile_views_received_30d ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Applications Sent:</span>
                      <span className="text-slate-300 font-semibold">{signals.applications_submitted_30d ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Search Appearances:</span>
                      <span className="text-slate-300 font-semibold">{signals.search_appearance_30d ?? 0}</span>
                    </div>
                    {signals.github_activity_score !== -1 && (
                      <div className="flex justify-between border-t border-slate-900 pt-1.5 mt-1.5 text-indigo-400 font-mono">
                        <span>GitHub Score:</span>
                        <span>{formatNumber(signals.github_activity_score, 1)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateModal;
