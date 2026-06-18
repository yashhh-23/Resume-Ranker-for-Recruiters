import { useState, useCallback } from "react";

/**
 * useCopyToClipboard
 * Copies both rich HTML (for Docs/Notion/Word) and plain-text fallback.
 * Returns { copy, copied, error }
 */
export function useCopyToClipboard(timeoutMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const copy = useCallback(async (plainText, htmlText = null) => {
    setError(null);
    try {
      if (htmlText && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([htmlText], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), timeoutMs);
    } catch (err) {
      setError(err);
      // Fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = plainText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), timeoutMs);
      } catch {
        /* silent */
      }
    }
  }, [timeoutMs]);

  return { copy, copied, error };
}

/* ──────────────────────────────────────────────────────────
   Rich-text builders — call these to generate (plain, html)
   ────────────────────────────────────────────────────────── */

/**
 * buildTagListCopy(label, items)
 * Produces a bullet-point list.
 */
export function buildTagListCopy(label, items = []) {
  const plain = `${label}\n${items.map((i) => `• ${i}`).join("\n")}`;
  const html = `<h3 style="font-family:monospace;margin:0 0 6px">${label}</h3>
<ul style="font-family:monospace;margin:0;padding-left:16px">
  ${items.map((i) => `<li style="margin:2px 0">${i}</li>`).join("")}
</ul>`;
  return { plain, html };
}

/**
 * buildScoreTableCopy(rows, overall)
 * rows: [{ label, val, weight }]
 */
export function buildScoreTableCopy(rows = [], overall = 0) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const plain =
    `5-Dimensional Discovery Scores\n` +
    `${"─".repeat(52)}\n` +
    `${"Metric".padEnd(20)}${"Score".padEnd(10)}${"Weight".padEnd(10)}Contribution\n` +
    `${"─".repeat(52)}\n` +
    rows.map((r) =>
      `${r.label.padEnd(20)}${pct(r.val).padEnd(10)}${`×${Math.round(r.weight * 100)}%`.padEnd(10)}+${pct(r.val * r.weight)}`
    ).join("\n") +
    `\n${"─".repeat(52)}\n` +
    `${"Overall Fit Index".padEnd(30)}${pct(overall)}`;

  const html = `
<table style="border-collapse:collapse;font-family:monospace;font-size:12px;width:100%">
  <caption style="font-weight:bold;text-align:left;padding-bottom:6px">5-Dimensional Discovery Scores</caption>
  <thead>
    <tr style="border-bottom:2px solid #334155">
      <th style="text-align:left;padding:4px 8px">Metric</th>
      <th style="text-align:right;padding:4px 8px">Score</th>
      <th style="text-align:center;padding:4px 8px">Weight</th>
      <th style="text-align:right;padding:4px 8px">Contribution</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r) => `
    <tr style="border-bottom:1px solid #1e293b">
      <td style="padding:4px 8px;font-weight:bold">${r.label}</td>
      <td style="padding:4px 8px;text-align:right">${pct(r.val)}</td>
      <td style="padding:4px 8px;text-align:center">×${Math.round(r.weight * 100)}%</td>
      <td style="padding:4px 8px;text-align:right;font-weight:bold">+${pct(r.val * r.weight)}</td>
    </tr>`).join("")}
    <tr style="border-top:2px solid #334155;font-weight:bold">
      <td colspan="3" style="padding:6px 8px">Overall Fit Index</td>
      <td style="padding:6px 8px;text-align:right;color:#10B981">${pct(overall)}</td>
    </tr>
  </tbody>
</table>`;
  return { plain, html };
}

/**
 * buildSkillsTableCopy(skillRows)
 * skillRows: [{ name, proficiency, assessment, duration }]
 */
export function buildSkillsTableCopy(skillRows = []) {
  const plain =
    `Skills Assessment Ledger\n` +
    `${"─".repeat(56)}\n` +
    `${"Skill".padEnd(24)}${"Proficiency".padEnd(16)}Assessment\n` +
    `${"─".repeat(56)}\n` +
    skillRows.map((s) =>
      `${String(s.name).padEnd(24)}${String(s.proficiency || "—").padEnd(16)}${s.assessment != null ? `${s.assessment}%` : "—"}`
    ).join("\n");

  const html = `
<table style="border-collapse:collapse;font-family:monospace;font-size:12px;width:100%">
  <caption style="font-weight:bold;text-align:left;padding-bottom:6px">Skills Assessment Ledger</caption>
  <thead>
    <tr style="border-bottom:2px solid #334155">
      <th style="text-align:left;padding:4px 8px">Skill</th>
      <th style="text-align:left;padding:4px 8px">Proficiency</th>
      <th style="text-align:right;padding:4px 8px">Assessed Score</th>
    </tr>
  </thead>
  <tbody>
    ${skillRows.map((s) => `
    <tr style="border-bottom:1px solid #1e293b">
      <td style="padding:4px 8px;font-weight:bold">${s.name}</td>
      <td style="padding:4px 8px;text-transform:capitalize">${s.proficiency || "—"}</td>
      <td style="padding:4px 8px;text-align:right;font-weight:bold;color:#10B981">${s.assessment != null ? `${s.assessment}%` : "—"}</td>
    </tr>`).join("")}
  </tbody>
</table>`;
  return { plain, html };
}

/**
 * buildSkillGapCopy(matched, missing)
 */
export function buildSkillGapCopy(matchedJdSkills = [], missingSkills = []) {
  const plain =
    `JD Skill Gap Analysis\n` +
    `${"─".repeat(40)}\n\n` +
    `✅ Matched JD Skills (${matchedJdSkills.length})\n` +
    matchedJdSkills.map((s) => `  • ${s.name} (${s.proficiency || "intermediate"})`).join("\n") +
    `\n\n❌ Missing / Skill Gaps (${missingSkills.length})\n` +
    missingSkills.map((s) => `  • ${s}`).join("\n");

  const html = `
<h3 style="font-family:monospace;font-size:13px;margin:0 0 8px">JD Skill Gap Analysis</h3>
<h4 style="font-family:monospace;font-size:11px;color:#10B981;margin:0 0 4px">✅ Matched JD Skills (${matchedJdSkills.length})</h4>
<ul style="font-family:monospace;font-size:11px;margin:0 0 12px;padding-left:16px;color:#10B981">
  ${matchedJdSkills.map((s) => `<li><b>${s.name}</b> <span style="color:#64748b">(${s.proficiency || "intermediate"})</span></li>`).join("")}
</ul>
<h4 style="font-family:monospace;font-size:11px;color:#f43f5e;margin:0 0 4px">❌ Missing / Skill Gaps (${missingSkills.length})</h4>
<ul style="font-family:monospace;font-size:11px;margin:0;padding-left:16px;color:#f43f5e">
  ${missingSkills.map((s) => `<li>${s}</li>`).join("")}
</ul>`;
  return { plain, html };
}

/**
 * buildReasoningCopy(sections, signalReasoning)
 */
export function buildReasoningCopy(sections = [], signalReasoning = null) {
  const lines = ["Multi-Dimensional Reasoning Trace", "═".repeat(50)];
  sections.forEach((sect) => {
    lines.push(`\n▶ ${sect.label}`);
    lines.push(`  Score: ${Math.round((sect.score ?? 0) * 100)}%  ·  Weight: ${Math.round((sect.weight ?? 0) * 100)}%`);
    if (signalReasoning?.[sect.id]) {
      lines.push(`  Insight: ${signalReasoning[sect.id]}`);
    }
  });

  const plain = lines.join("\n");

  const html = `
<h3 style="font-family:monospace;font-size:13px;margin:0 0 12px">Multi-Dimensional Reasoning Trace</h3>
${sections.map((sect) => `
<div style="margin-bottom:12px;border-left:3px solid ${sect.accentHex};padding-left:10px">
  <b style="font-family:monospace;font-size:12px">${sect.label}</b><br/>
  <span style="font-family:monospace;font-size:11px;color:#64748b">Score: ${Math.round((sect.score ?? 0) * 100)}%  ·  Weight: ${Math.round((sect.weight ?? 0) * 100)}%</span>
  ${signalReasoning?.[sect.id] ? `<br/><span style="font-family:monospace;font-size:11px;color:#10B981">${signalReasoning[sect.id]}</span>` : ""}
</div>`).join("")}`;

  return { plain, html };
}

/**
 * buildTimelineCopy(careerHistory)
 */
export function buildTimelineCopy(careerHistory = []) {
  if (!careerHistory?.length) return { plain: "No career history available.", html: "<p>No career history available.</p>" };
  const plain =
    `Career Timeline\n` +
    `${"─".repeat(50)}\n` +
    careerHistory.map((r, i) =>
      `${i + 1}. ${r.title || "—"} @ ${r.company || "—"}  [${r.start_year || "?"}–${r.end_year || "Present"}]\n` +
      (r.description ? `   ${r.description.slice(0, 160)}…` : "")
    ).join("\n");

  const html = `
<h3 style="font-family:monospace;font-size:13px;margin:0 0 10px">Career Timeline</h3>
<ol style="font-family:monospace;font-size:11px;padding-left:16px;margin:0">
  ${careerHistory.map((r) => `
  <li style="margin-bottom:8px">
    <b>${r.title || "—"}</b> @ ${r.company || "—"}
    <br/><span style="color:#64748b">${r.start_year || "?"}–${r.end_year || "Present"}</span>
    ${r.description ? `<br/><span>${r.description.slice(0, 200)}</span>` : ""}
  </li>`).join("")}
</ol>`;
  return { plain, html };
}
