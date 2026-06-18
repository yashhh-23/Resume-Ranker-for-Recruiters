import { memo } from "react";
import { formatDate } from "../../utils/formatters";
import CopyButton from "../CopyButton";
import { buildTimelineCopy } from "../../utils/copyUtils";

const getCompanyCategory = (industry) => {
  if (!industry) return "Unknown";
  return industry.toLowerCase().includes("it") ? "IT Services" : "Product";
};

const getRoleAnomaly = (role, index, career) => {
  const start = role.start_date;
  const end = role.end_date || new Date().toISOString();
  const duration = Number(role.duration_months || 0);

  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    const computed = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
    if (Math.abs(computed - duration) > 3) {
      return `Duration mismatch (reported ${duration}m, computed ${computed}m)`;
    }
    if (computed < 0) {
      return "Negative duration (invalid date order)";
    }
  }

  const currentInterval = { start: new Date(start), end: new Date(end) };
  for (let i = 0; i < career.length; i++) {
    if (i === index) continue;
    const other = career[i];
    const otherStart = other.start_date;
    const otherEnd = other.end_date || new Date().toISOString();
    if (!otherStart || !otherEnd) continue;
    const otherInterval = { start: new Date(otherStart), end: new Date(otherEnd) };
    if (currentInterval.start < otherInterval.end && otherInterval.start < currentInterval.end) {
      return `Overlaps with role: ${other.title} at ${other.company}`;
    }
  }

  return null;
};

const CandidateModalTimeline = memo(({
  careerHistory = [],
}) => {
  return (
    <section className="border border-slate-900 bg-slate-900/10 p-5 flex flex-col rounded-none font-mono text-xs">
      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono border-b border-slate-900 pb-3 mb-4 flex items-center justify-between">
        <span>Employment Timeline Trace</span>
        <CopyButton
          plain={buildTimelineCopy(careerHistory).plain}
          html={buildTimelineCopy(careerHistory).html}
          label="Copy career timeline"
        />
      </h4>
      {(!careerHistory || careerHistory.length === 0) ? (
        <div className="flex-1 flex items-center justify-center py-12 text-center">
          <p className="text-xs font-mono text-slate-600">
            No historical career timelines recorded in this profile registry.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l border-slate-800 space-y-6 flex-1">
          {careerHistory.map((role, index) => {
            const roleAnomaly = getRoleAnomaly(role, index, careerHistory || []);
            return (
              <div key={`${role.company}-${index}`} className="relative group text-left">
                {/* timeline marker */}
                <div
                  className={`absolute -left-[30px] top-1.5 h-3 w-3 border-2 bg-slate-950 transition-all duration-300 rounded-none ${
                    roleAnomaly 
                      ? "border-amber shadow-[0_0_8px_rgba(217,119,6,0.3)]" 
                      : "border-slate-700 group-hover:border-emerald"
                  }`}
                  style={roleAnomaly ? { animation: "pulse 2s ease-in-out 2" } : undefined}
                />
                
                <div className={`p-3.5 border transition-all duration-300 rounded-none ${
                  roleAnomaly 
                    ? "bg-amber/5 border-amber/25 shadow-sm shadow-amber-500/5" 
                    : "bg-slate-950/60 border-slate-900 group-hover:border-slate-800"
                }`}>
                  <div className="flex justify-between items-start flex-wrap gap-1">
                    <h5 className="text-xs font-semibold text-slate-100 font-mono">{role.title}</h5>
                    <span className="text-[10px] font-mono text-slate-500">
                      {formatDate(role.start_date)} - {role.end_date ? formatDate(role.end_date) : "Present"}
                    </span>
                  </div>
                  <p className="text-xs text-emerald mt-0.5 font-mono">{role.company}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-mono">
                    {role.industry} · {getCompanyCategory(role.industry)} · {role.company_size} emp
                  </p>
                  {role.description && (
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed italic border-t border-slate-900 pt-2 font-mono">
                      &ldquo;{role.description}&rdquo;
                    </p>
                  )}
                  {roleAnomaly && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="mt-2.5 flex items-center gap-1.5 text-[10px] font-mono text-amber border border-amber/20 bg-amber/10 p-1.5 rounded-none animate-pulse"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{roleAnomaly}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});

CandidateModalTimeline.displayName = "CandidateModalTimeline";

export default CandidateModalTimeline;
