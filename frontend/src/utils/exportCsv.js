/**
 * exportCsv.js — Export ranked results as hackathon-format CSV
 * Format: candidate_id,rank,score,skill_match,career_fit,engagement_signals,education,availability,reasoning,compliance_flags
 *
 * RFC 4180 compliant: CRLF row separators, UTF-8 BOM for Excel on Windows.
 * Note: internal scoring key is `signal_modifier`; the CSV column is labeled
 * `engagement_signals` to match the judge-facing UI label.
 */

/**
 * Trigger a browser download of the ranked results as submission.csv
 * @param {Array} rankedResults - Array of { candidate_id, rank, score, breakdown, reasoning, compliance_flags }
 */
export const exportSubmissionCsv = (rankedResults) => {
  if (!rankedResults || rankedResults.length === 0) return;

  const header =
    "candidate_id,rank,score,skill_match,career_fit,engagement_signals,education,availability,reasoning,compliance_flags";

  const rows = rankedResults.map((r, i) => {
    const id   = r.candidate_id ?? "";
    const rank = i + 1;

    // Normalize score to 0.0–1.0
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const scoreVal = rawScore > 1 ? rawScore / 100 : rawScore;
    const score    = scoreVal.toFixed(4);

    // Score breakdown per dimension
    const bd = r.breakdown || {};
    const toVal = (v) => {
      const n = typeof v === "number" ? v : parseFloat(v) || 0;
      return (n > 1 ? n / 100 : n).toFixed(4);
    };
    const skillMatch = toVal(bd.skill_match      ?? r.skill_match);
    const careerFit  = toVal(bd.career_fit       ?? r.career_fit);
    const signalMod  = toVal(bd.signal_modifier  ?? r.signal_modifier); // internal key
    const education  = toVal(bd.education        ?? r.education);
    const avail      = toVal(bd.availability     ?? r.availability);

    // Compliance flags (array → semicolon-joined string)
    const flags = Array.isArray(r.compliance_flags)
      ? r.compliance_flags.join("; ")
      : (r.compliance_flags ?? "");

    // RFC 4180 quoting: wrap in double-quotes, escape internal double-quotes
    const reasoning = String(r.reasoning ?? "").replace(/"/g, '""');
    const flagsEsc  = String(flags).replace(/"/g, '""');

    return `${id},${rank},${score},${skillMatch},${careerFit},${signalMod},${education},${avail},"${reasoning}","${flagsEsc}"`;
  });

  // CRLF row separators (RFC 4180) + UTF-8 BOM so Excel opens it correctly on Windows
  const BOM = "\uFEFF";
  const csv  = BOM + [header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = "submission.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
