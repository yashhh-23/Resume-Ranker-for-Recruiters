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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5 flex-wrap items-center">
        {/* Search Input */}
        <div className="flex-1 min-w-[200px] relative">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, headline, company, location..."
            className="w-full rounded-none border border-slate-800 bg-slate-950/50 px-3.5 py-1 pl-8 text-xs text-slate-200 placeholder-slate-600 focus:border-cobalt/60 focus:ring-1 focus:ring-cobalt/20 focus:outline-none transition-all duration-200 ease-in-out font-mono h-[28px]"
          />
          <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* ViewMode toggle buttons configuration */}
        <div className="flex border border-slate-800 bg-slate-950/80 p-0.5 rounded-none shrink-0 h-[28px] items-center">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-0.5 text-[11px] font-mono flex items-center gap-1 transition-all duration-200 rounded-none h-full ${
              viewMode === "list" 
                ? "bg-slate-800 text-slate-100 font-bold border border-slate-700" 
                : "text-slate-500 hover:text-slate-300 border border-transparent"
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
            className={`px-2.5 py-0.5 text-[11px] font-mono flex items-center gap-1 transition-all duration-200 rounded-none h-full ${
              viewMode === "podium" 
                ? "bg-slate-800 text-slate-100 font-bold border border-slate-700" 
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
            title="Switch to Top 3 Podium View"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Podium</span>
          </button>
        </div>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-none border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[11px] font-mono text-slate-300 focus:border-cobalt focus:outline-none transition-all duration-200 h-[28px]"
        >
          <option value={SORT_KEYS.RANK}>Sort by Rank</option>
          <option value={SORT_KEYS.SCORE}>Sort by Score</option>
          <option value={SORT_KEYS.ENGAGEMENT}>Sort by Engagement (Signals)</option>
          <option value={SORT_KEYS.EXPERIENCE}>Sort by Experience</option>
          <option value={SORT_KEYS.NOTICE}>Sort by Notice Period</option>
          <option value={SORT_KEYS.COMPLETENESS}>Sort by Profile Completeness</option>
          <option value={SORT_KEYS.SKILLS}>Sort by Skills Count</option>
        </select>
      </div>

      {/* Filters (only for shortlist) */}
      {activeTab === "shortlist" && (
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mr-1">Filters:</span>
          
          <button
            type="button"
            onClick={() => setAvailableOnly(!availableOnly)}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              availableOnly 
                ? "bg-cobalt/15 border-cobalt/40 text-cobalt font-medium shadow-sm shadow-cobalt/10" 
                : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800"
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
                : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800"
            }`}
          >
            GitHub Attached
          </button>

          <div className="h-3 w-px bg-slate-850 mx-1 font-mono"></div>

          <button
            type="button"
            onClick={() => setAnomalyFilter(anomalyFilter === "all" ? "exclude" : "all")}
            className={`px-2 py-0.5 border transition-all duration-200 rounded-none font-mono ${
              anomalyFilter === "exclude"
                ? "bg-emerald/15 border-emerald/40 text-emerald font-medium shadow-sm shadow-emerald/10"
                : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800"
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
                : "bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800"
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
