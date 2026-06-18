import { useState, useEffect } from "react";
import { SORT_KEYS } from "../constants/sortKeys";

const ResultsControls = ({
  query,
  setQuery,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  activeTab,
  availableOnly,
  setAvailableOnly,
  githubOnly,
  setGithubOnly,
  anomalyFilter,
  setAnomalyFilter,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    if (!showSortMenu) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest(".sort-menu-container")) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [showSortMenu]);

  const sortOptions = [
    { value: SORT_KEYS.RANK, label: "Sort by Rank" },
    { value: SORT_KEYS.SCORE, label: "Sort by Score" },
    { value: SORT_KEYS.ENGAGEMENT, label: "Sort by Engagement" },
    { value: SORT_KEYS.EXPERIENCE, label: "Sort by Experience" },
    { value: SORT_KEYS.NOTICE, label: "Sort by Notice Period" },
    { value: SORT_KEYS.COMPLETENESS, label: "Sort by Profile Completeness" },
    { value: SORT_KEYS.SKILLS, label: "Sort by Skills Count" },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-1.5 flex-wrap items-center">
        {/* Search Input with Integrated Sort Menu */}
        <div className="flex-1 min-w-[200px] relative sort-menu-container">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, headline, company, location..."
            className="w-full rounded-none border border-slate-800 bg-slate-950/50 px-3.5 py-1 pl-8 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:border-cobalt/60 focus:ring-1 focus:ring-cobalt/20 focus:outline-none transition-all duration-200 ease-in-out font-mono h-[28px]"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>

          {/* Inline Filter/Sort Icon Button */}
          <button
            type="button"
            onClick={() => setShowSortMenu(!showSortMenu)}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 hover:text-white transition-colors flex items-center justify-center h-4 w-4 ${
              showSortMenu ? "text-emerald" : "text-slate-500"
            }`}
            title="Sort options"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </button>

          {/* Absolute Dropdown Sort Menu */}
          {showSortMenu && (
            <div className="absolute right-0 top-[32px] z-[50] w-56 bg-slate-950/95 backdrop-blur-md border border-slate-800 shadow-2xl shadow-black/80 font-mono text-[11px] text-slate-300">
              <div className="p-1.5 border-b border-slate-800 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                Sort Candidates
              </div>
              <div className="flex flex-col py-1">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSortBy(opt.value);
                      setShowSortMenu(false);
                    }}
                    className={`px-3 py-1.5 text-left hover:bg-slate-900 transition-colors flex items-center justify-between ${
                      sortBy === opt.value ? "text-emerald font-bold bg-slate-900/40" : "text-slate-400"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.value && <span className="text-emerald font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ViewMode toggle buttons configuration */}
        <div className="flex border border-slate-800 bg-slate-950/80 p-0.5 rounded-none shrink-0 h-[28px] items-center font-mono">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-0.5 text-[11px] flex items-center gap-1 transition-all duration-200 rounded-none h-full ${
              viewMode === "list" 
                ? "bg-slate-800 text-slate-100 font-bold" 
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/30"
            }`}
            title="Switch to Flat List View"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Flat List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("podium")}
            className={`px-2.5 py-0.5 text-[11px] flex items-center gap-1 transition-all duration-200 rounded-none h-full ${
              viewMode === "podium" 
                ? "bg-slate-800 text-slate-100 font-bold" 
                : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/30"
            }`}
            title="Switch to Top 3 Podium View"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Podium</span>
          </button>
        </div>
      </div>

      {/* Filters (only for shortlist) */}
      {activeTab === "shortlist" && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mr-1.5">Filters:</span>
          
          <button
            type="button"
            onClick={() => setAvailableOnly(!availableOnly)}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              availableOnly 
                ? "bg-cobalt/15 border-cobalt/40 text-cobalt font-medium shadow-sm shadow-cobalt/10" 
                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/20"
            }`}
          >
            Notice &le; 30 Days
          </button>

          <button
            type="button"
            onClick={() => setGithubOnly(!githubOnly)}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              githubOnly 
                ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-400 font-medium shadow-sm shadow-indigo-500/10" 
                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/20"
            }`}
          >
            GitHub Attached
          </button>

          <div className="h-3.5 w-px bg-slate-800 mx-1.5 font-mono"></div>

          <button
            type="button"
            onClick={() => setAnomalyFilter(anomalyFilter === "all" ? "exclude" : "all")}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              anomalyFilter === "exclude"
                ? "bg-emerald/15 border-emerald/40 text-emerald font-medium shadow-sm shadow-emerald/10"
                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/20"
            }`}
          >
            Hide Anomalies
          </button>

          <button
            type="button"
            onClick={() => setAnomalyFilter(anomalyFilter === "only" ? "all" : "only")}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              anomalyFilter === "only"
                ? "bg-amber/15 border-amber/40 text-amber font-medium shadow-sm shadow-amber/10"
                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/20"
            }`}
          >
            Anomalies Only
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultsControls;
