import { memo } from "react";

const CandidateModalHeader = memo(({
  profile = {},
  candidate = {},
  result = {},
  isInAnyPool = false,
  onOpenPoolManager = null,
  onClose = null,
  isSuspiciousProfile = false,
}) => {
  return (
    <div className="flex flex-col shrink-0">
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-900 bg-slate-950">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-mono">Profile Explorer</p>
          <h3 className="text-xl font-bold text-white mt-1">{profile.anonymized_name || "Anonymized Candidate"}</h3>
          <p className="text-xs text-slate-400 mt-1 font-mono">{profile.headline || "No Headline Stated"}</p>
        </div>
        <div className="flex items-center gap-3">
          {onOpenPoolManager && (
            <button
              type="button"
              onClick={(e) => onOpenPoolManager(candidate, result, e)}
              className={`px-4 py-2 text-xs uppercase tracking-wider font-mono border transition-all duration-200 rounded-none flex items-center gap-2 ${
                isInAnyPool
                  ? "border-emerald/40 bg-emerald/10 text-emerald hover:bg-emerald/20"
                  : "border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill={isInAnyPool ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>{isInAnyPool ? "In Talent Pool" : "Add to Pool"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs uppercase tracking-wider font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-none transition-all duration-200"
          >
            Close
          </button>
        </div>
      </div>

      {/* Honeypot Shield: Suspicious Profile Warning Banner */}
      {isSuspiciousProfile && (
        <div className="bg-amber-950/40 border border-amber-600 text-amber-500 font-mono text-xs px-3 py-1.5 uppercase tracking-wider flex items-center gap-2 shrink-0 animate-pulse">
          <svg className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Suspicious Profile: High-Risk Logical Contradictions Flagged
        </div>
      )}
    </div>
  );
});

CandidateModalHeader.displayName = "CandidateModalHeader";

export default CandidateModalHeader;
