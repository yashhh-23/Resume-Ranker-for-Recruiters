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
  const rows = rankedResults.map((r) => {
    const id = r.candidate_id ?? "";
    const rank = r.rank ?? "";
    const score = typeof r.score === "number" ? r.score.toFixed(4) : r.score ?? "";
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
