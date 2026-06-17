/**
 * exportCsv.js — Export ranked results as hackathon-format CSV
 * Format: candidate_id,rank,score,reasoning
 */

/**
 * Trigger a browser download of the ranked results as submission.csv
 * @param {Array} rankedResults - Array of { candidate_id, rank, score, reasoning }
 */
export const exportSubmissionCsv = (rankedResults) => {
  if (!rankedResults || rankedResults.length === 0) return;

  const header = "candidate_id,rank,score,reasoning";
  const rows = rankedResults.map((r, i) => {
    const id = r.candidate_id ?? "";
    const rank = i + 1;
    // Normalize score to 0.0-1.0 if it is in 0-100 range
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const scoreVal = rawScore > 1 ? rawScore / 100 : rawScore;
    const score = scoreVal.toFixed(4);
    // Escape reasoning: wrap in quotes, escape internal quotes
    const reasoning = String(r.reasoning ?? "").replace(/"/g, '""');
    return `${id},${rank},${score},"${reasoning}"`;
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
