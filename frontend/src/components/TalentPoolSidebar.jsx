import { useState } from "react";

const TalentPoolSidebar = ({
  talentPools = [],
  onSelectPoolId,
  onCreateTalentPool,
  onDeleteTalentPool,
}) => {
  const [newPoolName, setNewPoolName] = useState("");
  const [creationError, setCreationError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = newPoolName.trim();
    if (!name) return;
    if (talentPools.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setCreationError("A talent pool with this name already exists.");
      return;
    }
    setCreationError("");
    onCreateTalentPool(name);
    setNewPoolName("");
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Creation form */}
      <div className="flex flex-col gap-3 border-b border-slate-900 pb-5">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end font-mono">
          <div className="flex-1">
            <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500 mb-1.5">
              Create New Talent Pool
            </p>
            <input
              value={newPoolName}
              onChange={(e) => {
                setNewPoolName(e.target.value);
                setCreationError("");
              }}
              placeholder="e.g., Immediate Frontend Hires"
              maxLength={40}
              className="w-full rounded-none border border-slate-800 bg-slate-950/50 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-700 focus:border-cobalt/60 focus:outline-none transition-all duration-200"
            />
          </div>
          <button
            type="submit"
            disabled={!newPoolName.trim()}
            className="bg-emerald hover:bg-emerald/90 disabled:opacity-30 disabled:hover:bg-emerald text-midnight font-bold px-5 py-2 text-xs uppercase tracking-wider transition-all duration-200 h-[32px] shrink-0"
          >
            + Create
          </button>
        </form>
        {creationError && (
          <p className="text-[10px] text-rose-500 font-mono">{creationError}</p>
        )}
      </div>

      {/* Grid of talent pools */}
      <div>
        {talentPools.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-900 bg-slate-950/20">
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              No Talent Pools Configured
            </p>
            <p className="text-xs text-slate-600 mt-1 font-mono">
              Create a talent pool above to begin watchlisting candidates.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {talentPools.map((pool) => (
              <div
                key={pool.id}
                onClick={() => onSelectPoolId(pool.id)}
                className="group border border-slate-900 hover:border-slate-800 bg-slate-950/40 p-4 transition-all duration-300 flex flex-col justify-between h-32 cursor-pointer relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-emerald transition-colors font-mono line-clamp-1">
                      {pool.name}
                    </h4>
                    {pool.id !== "default-watchlist" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Are you sure you want to delete the talent pool "${pool.name}"?`
                            )
                          ) {
                            onDeleteTalentPool(pool.id);
                          }
                        }}
                        className="text-slate-600 hover:text-rose-400 p-1 transition-colors"
                        title="Delete Talent Pool"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                    Created: {new Date(pool.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5 mt-2.5 font-mono text-[10px]">
                  <span className="text-slate-400">{pool.candidates.length} Profiles</span>
                  <span className="text-emerald group-hover:translate-x-1 transition-transform">Browse →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TalentPoolSidebar;
