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

  const sorted = [...rankedResults].sort((a, b) => {
    const sa = typeof a.score === "number" ? a.score : parseFloat(a.score) || 0;
    const sb = typeof b.score === "number" ? b.score : parseFloat(b.score) || 0;
    if (sa !== sb) return sb - sa;
    const ida = String(a.candidate_id ?? "");
    const idb = String(b.candidate_id ?? "");
    return ida.localeCompare(idb);
  });

  const header = "candidate_id,rank,score,reasoning";

  const rows = sorted.map((r, i) => {
    const id   = r.candidate_id ?? "";
    const rank = i + 1;

    // Normalize score to 0.0–1.0
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const scoreVal = rawScore > 1 ? rawScore / 100 : rawScore;
    const score    = scoreVal.toFixed(4);

    // RFC 4180 quoting: wrap in double-quotes, escape internal double-quotes
    const reasoning = String(r.reasoning ?? "").replace(/"/g, '""');

    return `${id},${rank},${score},"${reasoning}"`;
  });

  // CRLF row separators (RFC 4180) + UTF-8 BOM so Excel opens it correctly on Windows
  const encoder = new TextEncoder();
  const BOM     = new Uint8Array([0xEF, 0xBB, 0xBF]); // raw UTF-8 BOM bytes
  const csvContent = [header, ...rows].join("\r\n");
  const encoded = encoder.encode(csvContent);
  const blob    = new Blob([BOM, encoded], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = "submission.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
