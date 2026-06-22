import { useMemo, useState, useEffect } from "react";
import { validateSubmission } from "../utils/validation";
import { exportSubmissionCsv } from "../utils/exportCsv";

const ComplianceTray = ({ rankedResults, trayHeight }) => {
  const validation = useMemo(() => validateSubmission(rankedResults), [rankedResults]);
  const isReady = rankedResults.length > 0;

  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 1000
  );

  useEffect(() => {
    const handleResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isCompact = viewportHeight < 900;
  const actualHeight = isCompact ? 48 : (trayHeight || 110);

  if (isCompact) {
    return (
      <div
        style={{ height: `${actualHeight}px` }}
        className="border-t border-borderline bg-canvas/90 px-6 py-1.5 shrink-0 overflow-hidden compliance-container font-mono flex items-center justify-between"
      >
        <div className="flex flex-row items-center justify-between w-full gap-4 text-[11px]">
          <div>
            <p className="text-[8px] uppercase tracking-[0.2em] text-slate-500 leading-none">Validation Engine</p>
            <h3 className="text-[10px] font-bold text-slate-200 mt-0.5 leading-none">Technical Trace</h3>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="text-slate-500">Rows:</span>
              <strong className={validation.totalRows === 100 ? "text-emerald" : "text-amber"}>
                {validation.totalRows}/100
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">IDs:</span>
              <strong className={validation.uniqueCandidates === 100 ? "text-emerald" : "text-amber"}>
                {validation.uniqueCandidates}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">Ranks:</span>
              <strong className={validation.uniqueRanks === 100 ? "text-emerald" : "text-amber"}>
                {validation.uniqueRanks}
              </strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-slate-500">Status:</span>
              <strong className={validation.errors.length === 0 ? "text-emerald" : "text-amber"}>
                {validation.errors.length === 0 ? "COMPLIANT" : `${validation.errors.length} ALERTS`}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[9px] text-slate-500 uppercase leading-none">
              {isReady ? "Live" : "Idle"}
            </div>
            {isReady && (
              <button
                type="button"
                onClick={() => exportSubmissionCsv(rankedResults)}
                className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald/10 border border-emerald/30 hover:bg-emerald/20 hover:border-emerald/50 text-emerald font-mono text-[9px] uppercase tracking-wider transition-all duration-200 rounded-none h-[24px]"
                title="Export ranked results as submission.csv"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height: `${actualHeight}px` }}
      className="border-t border-borderline bg-canvas/90 px-6 py-2 shrink-0 overflow-y-auto custom-scrollbar compliance-container"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500 leading-none">Submission Validation Engine</p>
          <h3 className="text-xs font-semibold text-slate-100 font-mono mt-0.5 leading-none">Technical Trace</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-slate-500 font-mono">
            {isReady ? "Live" : "Idle"}
          </div>
          {isReady && (
            <button
              type="button"
              onClick={() => exportSubmissionCsv(rankedResults)}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald/10 border border-emerald/30 hover:bg-emerald/20 hover:border-emerald/60 text-emerald font-mono text-[10px] uppercase tracking-wider transition-all duration-200 rounded-none font-bold h-[26px]"
              title="Export ranked results as submission.csv"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-2 text-[10px] text-slate-400 font-mono">
        <div className="border border-slate-800 rounded-none p-1.5 bg-slate-950/20 flex items-center justify-between xl:block">
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">Element Counter</span>
          <p className={validation.totalRows === 100 ? "text-emerald font-bold xl:mt-0.5" : "text-amber font-bold xl:mt-0.5"}>
            {validation.totalRows}/100 rows
          </p>
        </div>
        <div className="border border-slate-800 rounded-none p-1.5 bg-slate-950/20 flex items-center justify-between xl:block">
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">Primary Key</span>
          <p className={validation.uniqueCandidates === 100 ? "text-emerald font-bold xl:mt-0.5" : "text-amber font-bold xl:mt-0.5"}>
            {validation.uniqueCandidates} unique IDs
          </p>
        </div>
        <div className="border border-slate-800 rounded-none p-1.5 bg-slate-950/20 flex items-center justify-between xl:block">
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">Rank Matrix</span>
          <p className={validation.uniqueRanks === 100 ? "text-emerald font-bold xl:mt-0.5" : "text-amber font-bold xl:mt-0.5"}>
            {validation.uniqueRanks} unique ranks
          </p>
        </div>
        <div className="border border-slate-800 rounded-none p-1.5 bg-slate-950/20 flex items-center justify-between xl:block">
          <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">Compliance</span>
          <p className={validation.errors.length === 0 ? "text-emerald font-bold xl:mt-0.5" : "text-amber font-bold xl:mt-0.5"}>
            {validation.errors.length === 0 ? "No structural errors" : `${validation.errors.length} alerts`}
          </p>
          {(() => {
            const flagged = rankedResults.filter(r => r.compliance_flags?.length > 0).length;
            return flagged > 0 ? (
              <p className="text-rose-400 text-[10px] mt-0.5">{flagged} candidates flagged by backend</p>
            ) : rankedResults.length > 0 ? (
              <p className="text-emerald/70 text-[10px] mt-0.5">0 data quality flags</p>
            ) : null;
          })()}
        </div>
      </div>

      {validation.errors.length > 0 && (
        <div className="mt-3 border border-amber/40 bg-amber/10 rounded-none p-3 text-xs text-amber font-mono">
          <ul className="space-y-1">
            {validation.errors.slice(0, 5).map((error) => (
              <li key={error}>{error}</li>
            ))}
            {validation.errors.length > 5 && (
              <li>Additional findings suppressed for focus.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ComplianceTray;
