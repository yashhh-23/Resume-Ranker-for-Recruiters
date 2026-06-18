import { formatPercent } from "./formatters";

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const average = (values) => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, current) => sum + current, 0) / values.length;
};

const safeNumber = (value) => (typeof value === "number" && !Number.isNaN(value) ? value : 0);

const monthsBetween = (start, end) => {
  if (!start || !end) {
    return null;
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
};

export const deriveBreakdown = (result, candidate) => {
  if (result?.breakdown) {
    const skill_match = clamp(result.breakdown.skill_match ?? result.breakdown.skill ?? 0);
    const career_fit = clamp(result.breakdown.career_fit ?? result.breakdown.semantic ?? 0);
    const signal_modifier = clamp(result.breakdown.signal_modifier ?? result.breakdown.activity ?? 0);
    const education = clamp(result.breakdown.education ?? 0);
    const availability = clamp(result.breakdown.availability ?? 0);
    return {
      skill_match,
      career_fit,
      signal_modifier,
      education,
      availability,
      // Backward compatibility aliases
      skill: skill_match,
      semantic: career_fit,
      activity: signal_modifier
    };
  }

  // Local fallback calculations matching backend mathematical structure
  const skillAssessments = candidate?.redrob_signals?.skill_assessment_scores || {};
  const assessmentValues = Object.values(skillAssessments).map((value) => safeNumber(value));
  const skillCount = candidate?.skills?.length || 0;
  const skillScore = clamp(assessmentValues.length > 0 ? (average(assessmentValues) / 100 * 0.7 + Math.min(skillCount / 20, 1) * 0.3) : Math.min(skillCount / 10, 1));

  const years = safeNumber(candidate?.profile?.years_of_experience);
  const careerFitScore = clamp(years / 15 * 0.6 + Math.min((candidate?.career_history?.length || 0) / 6, 1) * 0.4);

  const signals = candidate?.redrob_signals || {};
  const github = safeNumber(signals.github_activity_score ?? -1);
  const github_score = github < 0 ? 0.0 : clamp(github / 100.0);
  const response_rate = clamp(safeNumber(signals.recruiter_response_rate));
  const interview_completion = clamp(safeNumber(signals.interview_completion_rate));
  
  const assessment_score = assessmentValues.length > 0 ? clamp(average(assessmentValues) / 100.0) : 0.5;

  const offer = safeNumber(signals.offer_acceptance_rate ?? -1);
  const offer_score = offer < 0 ? 0.5 : clamp(offer);

  const completeness = safeNumber(signals.profile_completeness_score);
  const completeness_score = clamp(completeness / 100.0);

  const signalModifierScore = clamp((github_score + response_rate + interview_completion + assessment_score + offer_score + completeness_score) / 6);

  const education = candidate?.education || [];
  let bestEducationScore = 0.0;
  const TIER_WEIGHT = {
    tier_1: 1.0,
    tier_2: 0.75,
    tier_3: 0.5,
    tier_4: 0.3,
    unknown: 0.2
  };
  const DEGREE_WEIGHT = {
    phd: 1.0,
    master: 0.9,
    bachelor: 0.75,
    diploma: 0.5
  };

  if (education.length > 0) {
    for (const item of education) {
      const tierStr = String(item.tier || "unknown").toLowerCase();
      const tier = TIER_WEIGHT[tierStr] ?? TIER_WEIGHT.unknown;
      
      const field = String(item.field_of_study || "").toLowerCase();
      const isCsRelated = field.includes("computer") || field.includes("software") || field.includes("science") || field.includes("information") || field.includes("it") || field.includes("engineering") || field.includes("tech");
      const field_match = isCsRelated ? 1.0 : 0.6;
      
      const degree = String(item.degree || "").toLowerCase();
      let degree_mult = 0.6;
      for (const [key, val] of Object.entries(DEGREE_WEIGHT)) {
        if (degree.includes(key)) {
          degree_mult = val;
          break;
        }
      }
      const score = tier * field_match * degree_mult;
      if (score > bestEducationScore) {
        bestEducationScore = score;
      }
    }
  }
  const educationScore = clamp(bestEducationScore);

  const open_to_work = signals.open_to_work_flag ? 1.0 : 0.5;
  const notice_days = safeNumber(signals.notice_period_days ?? 180.0);
  const notice_score = clamp(1.0 - (notice_days / 180.0));
  const relocation = signals.willing_to_relocate ? 1.0 : 0.6;
  const availabilityScore = clamp((open_to_work + notice_score + relocation) / 3);

  return {
    skill_match: skillScore,
    career_fit: careerFitScore,
    signal_modifier: signalModifierScore,
    education: educationScore,
    availability: availabilityScore,
    // Backward compatibility aliases
    skill: skillScore,
    semantic: careerFitScore,
    activity: signalModifierScore
  };
};

export const deriveReasoning = (result, candidate) => {
  if (result?.reasoning) {
    return result.reasoning;
  }

  const profile = candidate?.profile || {};
  const title = profile.current_title || profile.headline || "Candidate";
  const years = safeNumber(profile.years_of_experience);
  const skillCount = candidate?.skills?.length ?? 0;
  const signals = candidate?.redrob_signals || {};
  const responseRate = signals.recruiter_response_rate;
  const responseText = responseRate != null ? formatPercent(responseRate) : "--";
  
  const bd = deriveBreakdown(null, candidate);
  const breakdownScores = {
    "skill_match": bd.skill_match,
    "career_fit": bd.career_fit,
    "signal_modifier": bd.signal_modifier,
    "education": bd.education,
    "availability": bd.availability
  };
  let top_component = "skill match";
  let maxVal = -1;
  for (const [k, v] of Object.entries(breakdownScores)) {
    if (v > maxVal) {
      maxVal = v;
      top_component = k.replace("_", " ");
    }
  }

  return `${title} with ${years.toFixed(1)} yrs; ${skillCount} skills; top signal ${top_component}; response rate ${responseText}.`;
};

export const computeFallbackRanking = (candidates) => {
  const scored = candidates.map((candidate) => {
    const breakdown = deriveBreakdown(null, candidate);
    const score =
      breakdown.skill_match * 0.35 +
      breakdown.career_fit * 0.25 +
      breakdown.signal_modifier * 0.15 +
      breakdown.education * 0.15 +
      breakdown.availability * 0.10;

    return {
      candidate_id: candidate.candidate_id,
      score: Number(score.toFixed(4)),
      reasoning: deriveReasoning(null, candidate),
      breakdown,
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.candidate_id.localeCompare(b.candidate_id);
  });

  return scored.slice(0, 100).map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
};

export const normalizeRankedResults = (results, candidates) => {
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.candidate_id, candidate])
  );

  return (results || []).map((result, index) => {
    const candidateId = result.candidate_id || result.candidateId || result.id;
    const candidate = candidateMap.get(candidateId);
    const breakdown = deriveBreakdown(result, candidate);

    return {
      candidate_id: candidateId,
      rank: Number(result.rank ?? index + 1),
      score: Number(result.score ?? result.total_score ?? result.final_score ?? 0),
      reasoning: deriveReasoning(result, candidate),
      breakdown,
      // Preserve rich API fields
      signal_reasoning: result.signal_reasoning || null,
      compliance_flags: result.compliance_flags || [],
      is_suspicious: result.is_suspicious ?? false,
      profile_completeness: result.profile_completeness ?? null,
    };
  });
};

export const detectTimelineAnomaly = (candidate) => {
  const history = candidate?.career_history || [];
  if (!history.length) {
    return false;
  }

  const intervals = [];
  let totalMonths = 0;

  for (const role of history) {
    const start = role.start_date;
    const end = role.end_date || new Date().toISOString();
    const duration = safeNumber(role.duration_months);

    if (!start || !end) {
      continue;
    }

    const computed = monthsBetween(start, end);
    if (computed != null && Math.abs(computed - duration) > 3) {
      return true;
    }

    if (computed != null && computed < 0) {
      return true;
    }

    totalMonths += duration;
    intervals.push({ start: new Date(start), end: new Date(end) });
  }

  intervals.sort((a, b) => a.start - b.start);
  for (let i = 1; i < intervals.length; i += 1) {
    if (intervals[i].start < intervals[i - 1].end) {
      return true;
    }
  }

  const years = safeNumber(candidate?.profile?.years_of_experience);
  if (years > 0 && totalMonths > years * 12 + 12) {
    return true;
  }

  return false;
};
