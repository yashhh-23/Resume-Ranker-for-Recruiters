/**
 * exportCsv.js — Export ranked results as hackathon-format CSV
 *
 * Spec (3-Point Structural Realignment):
 *   1. Header key:  candidateid  (no underscore)
 *   2. ID values:   CAND0081846  (underscore stripped from token)
 *   3. Column order: candidateid, rank, score, reasoning — exactly 100 rows
 *
 * RFC 4180 compliant: CRLF row separators, UTF-8 BOM for Excel on Windows.
 */

/**
 * Trigger a browser download of the ranked results as submission.csv
 * @param {Array} rankedResults - Array of { candidate_id, rank, score, breakdown, reasoning }
 */
export const exportSubmissionCsv = (rankedResults) => {
  if (!rankedResults || rankedResults.length === 0) return;

  // Sort by score descending, break ties by candidate_id ascending, cap at 100
  const sorted = [...rankedResults]
    .sort((a, b) => {
      const sa = typeof a.score === "number" ? a.score : parseFloat(a.score) || 0;
      const sb = typeof b.score === "number" ? b.score : parseFloat(b.score) || 0;
      if (sa !== sb) return sb - sa;
      return String(a.candidate_id ?? "").localeCompare(String(b.candidate_id ?? ""));
    })
    .slice(0, 100); // Fix 3: lock to exactly top 100

  // Fix 1: header uses candidateid (no underscore)
  const header = "candidateid,rank,score,reasoning";

  const rows = sorted.map((r, i) => {
    // Fix 2: strip underscores from the ID token  (CAND_0081846 → CAND0081846)
    const id = String(r.candidate_id ?? "").replace(/_/g, "");

    const rank = i + 1;

    // Normalize score to 0.0–1.0 range, then format to 4 dp
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const scoreVal = rawScore > 1 ? rawScore / 100 : rawScore;
    const score    = scoreVal.toFixed(4);

    // RFC 4180 quoting for reasoning field
    const reasoning = String(r.reasoning ?? "").replace(/"/g, '""');

    return `${id},${rank},${score},"${reasoning}"`;
  });

  // CRLF row separators (RFC 4180) + UTF-8 BOM so Excel opens correctly on Windows
  const encoder    = new TextEncoder();
  const BOM        = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const csvContent = [header, ...rows].join("\r\n");
  const encoded    = encoder.encode(csvContent);
  const blob       = new Blob([BOM, encoded], { type: "text/csv;charset=utf-8;" });
  const url        = URL.createObjectURL(blob);
  const link       = document.createElement("a");
  link.href        = url;
  link.download    = "submission.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
