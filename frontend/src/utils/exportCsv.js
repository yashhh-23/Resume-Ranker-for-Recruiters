/**
 * exportCsv.js — Export ranked results as hackathon-format CSV
 * Format: candidate_id,rank,score,skill_match,career_fit,signal_modifier,education,availability,reasoning,compliance_flags
 */

/**
 * Trigger a browser download of the ranked results as submission.csv
 * Includes full score breakdown columns for explainability.
 * @param {Array} rankedResults - Array of { candidate_id, rank, score, breakdown, reasoning, compliance_flags }
 */
export const exportSubmissionCsv = (rankedResults) => {
  if (!rankedResults || rankedResults.length === 0) return;

  const header = "candidate_id,rank,score,skill_match,career_fit,signal_modifier,education,availability,reasoning,compliance_flags";
  const rows = rankedResults.map((r, i) => {
    const id = r.candidate_id ?? "";
    const rank = i + 1;
    // Normalize score to 0.0-1.0 if it is in 0-100 range
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const scoreVal = rawScore > 1 ? rawScore / 100 : rawScore;
    const score = scoreVal.toFixed(4);

    // Score breakdown per dimension
    const bd = r.breakdown || {};
    const toVal = (v) => {
      const n = typeof v === "number" ? v : parseFloat(v) || 0;
      return (n > 1 ? n / 100 : n).toFixed(4);
    };
    const skillMatch = toVal(bd.skill_match ?? r.skill_match);
    const careerFit  = toVal(bd.career_fit  ?? r.career_fit);
    const signalMod  = toVal(bd.signal_modifier ?? r.signal_modifier);
    const education  = toVal(bd.education  ?? r.education);
    const avail      = toVal(bd.availability ?? r.availability);

    // Compliance flags joined
    const flags = Array.isArray(r.compliance_flags)
      ? r.compliance_flags.join("; ")
      : (r.compliance_flags ?? "");

    // Escape reasoning: wrap in quotes, escape internal quotes
    const reasoning = String(r.reasoning ?? "").replace(/"/g, '""');
    const flagsEsc  = String(flags).replace(/"/g, '""');
    return `${id},${rank},${score},${skillMatch},${careerFit},${signalMod},${education},${avail},"${reasoning}","${flagsEsc}"`;
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "submission.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
