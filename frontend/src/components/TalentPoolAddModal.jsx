import { useState } from "react";

const TalentPoolAddModal = ({
  poolCandidate,
  talentPools,
  onClose,
  onCreateTalentPool,
  onAddCandidateToTalentPool,
  onRemoveCandidateFromTalentPool,
}) => {
  const [newPoolName, setNewPoolName] = useState("");
  const [creationError, setCreationError] = useState("");

  if (!poolCandidate) return null;

  const { candidate, result } = poolCandidate;
  const candidateId = candidate.candidate_id;
  const candidateName = candidate.profile?.anonymized_name || "Unknown Candidate";

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newPoolName.trim();
    if (!trimmed) return;

    if (talentPools.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setCreationError("A talent pool with this name already exists.");
      return;
    }

    setCreationError("");
    onCreateTalentPool(trimmed, poolCandidate);
    setNewPoolName("");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="w-full max-w-md bg-slate-950 border border-slate-800 p-6 shadow-2xl relative animate-fade-in font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-900 pb-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Classification Node</p>
            <h3 className="text-sm font-bold text-white mt-1">Manage Talent Pools</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Candidate Context Info */}
        <div className="bg-slate-900/30 border border-slate-900 p-3 mb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Candidate</p>
          <p className="text-xs font-bold text-slate-200 mt-1">{candidateName}</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{candidate.profile?.headline || "No Headline"}</p>
        </div>

        {/* Talent Pools Checklist */}
        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1 mb-4 border-b border-slate-900 pb-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Assign to Pools</p>
          {talentPools.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No talent pools created yet.</p>
          ) : (
            talentPools.map((pool) => {
              const isMember = pool.candidates.some((c) => c.candidate_id === candidateId);
              return (
                <label
                  key={pool.id}
                  className="flex items-center justify-between p-2 hover:bg-slate-900/40 border border-transparent hover:border-slate-900 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isMember}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onAddCandidateToTalentPool(pool.id, candidate, result);
                        } else {
                          onRemoveCandidateFromTalentPool(pool.id, candidateId);
                        }
                      }}
                      className="accent-emerald h-3.5 w-3.5 bg-slate-950 border-slate-800 rounded-none focus:ring-0 focus:ring-offset-0"
                    />
                    <span className="text-xs text-slate-300 font-medium">{pool.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-600 bg-slate-950 border border-slate-900 px-1.5 py-0.5 rounded-none">
                    {pool.candidates.length} profiles
                  </span>
                </label>
              );
            })
          )}
        </div>

        {/* Create New Talent Pool Form */}
        <form onSubmit={handleCreate} className="space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Create New Talent Pool</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPoolName}
              onChange={(e) => {
                setNewPoolName(e.target.value);
                setCreationError("");
              }}
              placeholder="e.g. Sourced Backend Engineers"
              maxLength={40}
              className="flex-1 bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cobalt/60 transition-all rounded-none placeholder-slate-700"
            />
            <button
              type="submit"
              disabled={!newPoolName.trim()}
              className="bg-cobalt hover:bg-cobalt/90 disabled:opacity-40 disabled:hover:bg-cobalt text-white font-bold px-3 py-2 text-xs transition-colors rounded-none whitespace-nowrap"
            >
              Create & Add
            </button>
          </div>
          {creationError && (
            <p className="text-[10px] text-rose-500">{creationError}</p>
          )}
        </form>

        {/* Footer actions */}
        <div className="mt-6 flex justify-end border-t border-slate-900 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold px-4 py-2 text-xs transition-colors rounded-none"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TalentPoolAddModal;
