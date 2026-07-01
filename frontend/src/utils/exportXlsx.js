/**
 * exportXlsx.js — Export ranked results as beautifully formatted XLSX
 *
 * Format mirrors submission CSV exactly:
 *   Columns: candidateid | rank | score | reasoning
 *   100 rows, score to 4dp, sorted desc by score
 *
 * Styling:
 *   - Frozen header row with bold dark background + white text
 *   - Alternating row zebra striping (light green tint on even rows)
 *   - Auto column widths (padded)
 *   - Score column: number format "0.0000"
 *   - Rank column: integer format
 *   - Reasoning column: text wrap enabled
 */

import XLSX from "xlsx-js-style";

export const exportSubmissionXlsx = (rankedResults) => {
  if (!rankedResults || rankedResults.length === 0) return;

  // ── 1. Sort + cap (identical logic to exportCsv.js) ─────────────────────
  const sorted = [...rankedResults]
    .sort((a, b) => {
      const sa = typeof a.score === "number" ? a.score : parseFloat(a.score) || 0;
      const sb = typeof b.score === "number" ? b.score : parseFloat(b.score) || 0;
      if (sa !== sb) return sb - sa;
      return String(a.candidate_id ?? "").localeCompare(String(b.candidate_id ?? ""));
    })
    .slice(0, 100);

  // ── 2. Build rows ────────────────────────────────────────────────────────
  const rows = sorted.map((r, i) => {
    const id       = String(r.candidate_id ?? "").replace(/_/g, "");
    const rank     = i + 1;
    const rawScore = typeof r.score === "number" ? r.score : parseFloat(r.score) || 0;
    const score    = rawScore > 1 ? rawScore / 100 : rawScore;
    const reasoning = String(r.reasoning ?? "");
    return [id, rank, score, reasoning];
  });

  // ── 3. Create worksheet ──────────────────────────────────────────────────
  const wsData   = [["candidateid", "rank", "score", "reasoning"], ...rows];
  const ws       = XLSX.utils.aoa_to_sheet(wsData);

  // ── 4. Column widths (auto-pad) ──────────────────────────────────────────
  ws["!cols"] = [
    { wch: 16 },   // candidateid
    { wch: 6  },   // rank
    { wch: 10 },   // score
    { wch: 90 },   // reasoning  ← generous for the long strings
  ];

  // ── 5. Freeze top header row ─────────────────────────────────────────────
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
  // SheetJS uses !freeze for freeze panes:
  ws["!freeze"] = undefined;
  ws["!sheetViews"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];

  // ── 6. Cell styles (xlsx-js-style) ───────────────────────────────────────
  // Header row bold + dark background
  ["A1","B1","C1","D1"].forEach(addr => {
    if (!ws[addr]) return;
    ws[addr].s = {
      font:    { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
      fill:    { fgColor: { rgb: "1A2B3C" } },  // dark navy
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        bottom: { style: "medium", color: { rgb: "10B981" } }  // emerald accent
      }
    };
  });

  // ── 7. Number formats & zebra striping ───────────────────────────────────
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = 1; R <= range.e.r; ++R) {
    const isEven = R % 2 === 0;
    const fillColor = isEven ? "F0FDF4" : "FFFFFF"; // light green / white
    for (let C = 0; C <= 3; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddr]) continue;
      ws[cellAddr].s = {
        fill:      { fgColor: { rgb: fillColor } },
        alignment: { wrapText: C === 3, vertical: "top" }, // wrap reasoning only
        font:      { sz: 9 },
      };
    }

    const scoreCell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })]; // col C
    if (scoreCell) scoreCell.z = "0.0000";

    const rankCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })]; // col B
    if (rankCell) rankCell.z = "0";
  }

  // ── 8. Create workbook & trigger download ────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RRR Rankings");

  XLSX.writeFile(wb, "submission.xlsx", { compression: true, bookType: "xlsx" });
};
