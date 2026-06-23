import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import CandidateCard from "./CandidateCard";
import { detectTimelineAnomaly } from "../utils/scoreUtils";
import { exportPdfReport, exportWordReport } from "../utils/reportGenerator";
import { exportSubmissionCsv } from "../utils/exportCsv";
import LoadingPhaseDisplay from "./LoadingPhaseDisplay";
import TalentPoolSidebar from "./TalentPoolSidebar";
import ResultsControls from "./ResultsControls";
import { sortResults } from "../utils/sortResults";
import { SORT_KEYS } from "../constants/sortKeys";

const CompareModal = lazy(() => import("./CompareModal"));



const ResultsPanel = ({
  rankedResults,
  candidates,
  isLoading,
  onSelectCandidate,
  jobDescription,
  talentPools = [],
  onOpenPoolManager,
  onCreateTalentPool,
  onDeleteTalentPool,
  onRemoveCandidateFromTalentPool,
  executionTime,
  onReset,
}) => {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState(SORT_KEYS.RANK);
  const [anomalyFilter, setAnomalyFilter] = useState("all"); // "all" | "only" | "exclude"
  const [availableOnly, setAvailableOnly] = useState(false);
  const [githubOnly, setGithubOnly] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "podium"

  // Compare mode
  const [compareIds, setCompareIds] = useState([]); // up to 2 candidate_ids
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Staged loading messages (4 phases)
  const [loadingPhase, setLoadingPhase] = useState(0);

  useEffect(() => {
    if (!isLoading) { setLoadingPhase(0); return; }
    const t1 = setTimeout(() => setLoadingPhase(1), 1000);
    const t2 = setTimeout(() => setLoadingPhase(2), 2000);
    const t3 = setTimeout(() => setLoadingPhase(3), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isLoading]);



  const handleToggleCompare = (candidateId) => {
    setCompareIds((prev) => {
      if (prev.includes(candidateId)) return prev.filter((id) => id !== candidateId);
      if (prev.length >= 3) return prev; // hard cap at 3
      return [...prev, candidateId];
    });
  };

  // Talent Pool UI states
  const [activeTab, setActiveTab] = useState("shortlist"); // "shortlist" | "pools"
  const [selectedPoolId, setSelectedPoolId] = useState(null);
  const [newPoolName, setNewPoolName] = useState("");
  const [creationError, setCreationError] = useState("");

  const activeFiltersText = useMemo(() => {
    const filters = [];
    if (availableOnly) filters.push("Notice Period ≤ 30 Days");
    if (githubOnly) filters.push("GitHub Attached");
    if (anomalyFilter === "only") filters.push("Anomalies Only");
    if (anomalyFilter === "exclude") filters.push("Clean Timelines Only");
    if (query.trim()) filters.push(`Search: "${query.trim()}"`);
    return filters.join(", ") || "None (Full Shortlist)";
  }, [availableOnly, githubOnly, anomalyFilter, query]);

  const criteriaFiltered = useMemo(() => {
    const candidateMap = new Map(
      candidates.map((candidate) => [candidate.candidate_id, candidate])
    );

    const itemsList = rankedResults.map((result) => ({
      result,
      candidate: candidateMap.get(result.candidate_id),
    }));

    return itemsList.filter((row) => {
      const candidate = row.candidate;
      if (!candidate) return true;

      const isAnomaly = detectTimelineAnomaly(candidate);
      if (anomalyFilter === "only" && !isAnomaly) return false;
      if (anomalyFilter === "exclude" && isAnomaly) return false;

      if (availableOnly) {
        const notice = candidate.redrob_signals?.notice_period_days;
        if (notice == null || notice > 30) return false;
      }

      if (githubOnly) {
        const gh = candidate.redrob_signals?.github_activity_score;
        if (gh == null || gh === -1) return false;
      }

      return true;
    });
  }, [rankedResults, candidates, anomalyFilter, availableOnly, githubOnly]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    let itemsList = criteriaFiltered;

    if (search) {
      itemsList = itemsList.filter((row) => {
        const profile = row.candidate?.profile || {};
        const haystack = [
          profile.anonymized_name,
          profile.headline,
          profile.current_company,
          profile.current_title,
          profile.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    return sortResults(itemsList, sortBy);
  }, [criteriaFiltered, query, sortBy]);

  const poolCandidatesFiltered = useMemo(() => {
    if (activeTab !== "pools" || !selectedPoolId) return [];
    const activePool = talentPools.find((p) => p.id === selectedPoolId);
    if (!activePool) return [];

    const search = query.trim().toLowerCase();
    let list = activePool.candidates; // array of { candidate_id, candidate, result }

    if (search) {
      list = list.filter((row) => {
        const profile = row.candidate?.profile || {};
        const haystack = [
          profile.anonymized_name,
          profile.headline,
          profile.current_company,
          profile.current_title,
          profile.location,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    return sortResults(list, sortBy);
  }, [activeTab, selectedPoolId, talentPools, query, sortBy]);

  const activeList =
    activeTab === "pools" && selectedPoolId
      ? poolCandidatesFiltered
      : filtered;

  // Virtualization window state & scroll tracking hooks
  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [query, sortBy, anomalyFilter, availableOnly, githubOnly, activeTab, selectedPoolId, rankedResults.length, criteriaFiltered.length]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setVisibleCount((prev) => Math.min(prev + 30, activeList.length));
    }
  };

  const slicedList = useMemo(() => {
    return activeList.slice(0, visibleCount);
  }, [activeList, visibleCount]);

  const stats = useMemo(() => {
    if (activeList.length === 0) {
      return { total: 0, avgScore: "0.0", anomalies: 0, availablePct: "0" };
    }

    const total = activeList.length;
    let sumScore = 0;
    let anomalies = 0;
    let availableCount = 0;

    activeList.forEach(({ result, candidate }) => {
      const score = result.score <= 1 ? result.score * 100 : result.score;
      sumScore += score;

      if (candidate) {
        if (detectTimelineAnomaly(candidate)) {
          anomalies++;
        }
        const notice = candidate.redrob_signals?.notice_period_days;
        if (notice != null && notice <= 30) {
          availableCount++;
        }
      }
    });

    return {
      total,
      avgScore: (sumScore / total).toFixed(1),
      anomalies,
      availablePct: ((availableCount / total) * 100).toFixed(0),
    };
  }, [activeList]);

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    const activePool = talentPools.find((p) => p.id === selectedPoolId);
    try {
      await exportPdfReport(
        activeList,
        activeTab === "pools"
          ? `Talent Pool Export: ${activePool?.name || ""}`
          : jobDescription,
        stats,
        query,
        sortBy,
        activeTab === "pools"
          ? `Talent Pool: ${activePool?.name || ""}`
          : activeFiltersText
      );
    } catch (err) {
      alert("Unable to generate PDF report.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportWord = () => {
    const activePool = talentPools.find((p) => p.id === selectedPoolId);
    exportWordReport(
      activeList,
      activeTab === "pools"
        ? `Talent Pool Export: ${activePool?.name || ""}`
        : jobDescription,
      stats,
      query,
      sortBy,
      activeTab === "pools"
        ? `Talent Pool: ${activePool?.name || ""}`
        : activeFiltersText
    );
  };

  return (
    <div className="flex-1 flex flex-col border-b border-borderline bg-canvas min-h-0 overflow-hidden">
      <div id="guide-target-results-header" className="px-4 py-2 border-b border-borderline/80 flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-mono leading-none">
              {activeTab === "shortlist" ? "Shortlist Console" : "Talent Pool Console"}
            </p>
            <h2 className="text-base font-bold text-white mt-0.5 flex items-center gap-2 flex-wrap leading-tight">
              <span>{activeTab === "shortlist" ? "Ranked Shortlist" : "Talent Pools"}</span>
              {activeTab === "shortlist" && executionTime && (
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-none text-[9px] font-mono font-bold bg-emerald/10 text-emerald border border-emerald/20">
                  ⚡ {executionTime}s
                </span>
              )}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Pools vs Shortlist Tab Switcher */}
            <div className="flex border border-slate-800 bg-slate-950/80 p-0.5 rounded-none shrink-0 font-mono h-[28px] items-center">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("shortlist");
                  setSelectedPoolId(null);
                }}
                className={`px-2.5 py-0.5 text-[11px] transition-all duration-200 rounded-none font-bold uppercase tracking-wider h-full flex items-center ${
                  activeTab === "shortlist"
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/30"
                }`}
              >
                Shortlist
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("pools");
                  setSelectedPoolId(null);
                }}
                className={`px-2.5 py-0.5 text-[11px] transition-all duration-200 rounded-none font-bold uppercase tracking-wider flex items-center gap-1.5 h-full ${
                  activeTab === "pools"
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-900/30"
                }`}
              >
                <span>Pools</span>
                <span className="px-1 py-0.2 rounded-full text-[9px] bg-slate-950 border border-slate-800 text-slate-400">
                  {talentPools.length}
                </span>
              </button>
            </div>

            {/* Export buttons + Compare button */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Compare button — appears when 2 candidates selected */}
              {compareIds.length >= 2 && activeTab === "shortlist" && (
                <button
                  type="button"
                  onClick={() => setShowCompareModal(true)}
                  className="text-[10px] bg-amber/10 border border-amber/40 hover:bg-amber/20 text-amber font-bold px-2 py-1 rounded-none flex items-center gap-1.5 transition-all duration-200 font-mono animate-pulse"
                  title={`Compare ${compareIds.length} selected candidates`}
                >
                  Compare {compareIds.length}
                </button>
              )}
              {compareIds.length > 0 && activeTab === "shortlist" && (
                <span className="text-[9px] font-mono text-amber border border-amber/20 px-2 py-0.5 bg-amber/5 rounded-none">
                  {compareIds.length}/3 Compare
                </span>
              )}

              {((activeTab === "shortlist" && rankedResults.length > 0) ||
                (activeTab === "pools" && selectedPoolId && poolCandidatesFiltered.length > 0)) && (
                <>
                  {onReset && (
                    <button
                      type="button"
                      onClick={onReset}
                      className="text-[10px] bg-slate-900 border border-slate-800 hover:border-rose-900/60 hover:bg-rose-950/20 hover:text-rose-400 font-bold px-2 py-1 rounded-none font-mono transition-all duration-200"
                      title="Reset Workspace"
                    >
                      Reset
                    </button>
                  )}

                  <span className="px-2 py-1 bg-slate-900 border border-slate-800 text-slate-400 font-mono text-[10px] rounded-none">
                    {activeList.length} matching
                  </span>

                  {/* CSV Export */}
                  {activeTab === "shortlist" && (
                    <button
                      type="button"
                      disabled={rankedResults.length === 0}
                      onClick={() => exportSubmissionCsv(rankedResults)}
                      className="text-[10px] bg-emerald/10 border border-emerald/30 hover:bg-emerald/20 hover:border-emerald/50 text-emerald font-bold px-2 py-1 rounded-none flex items-center gap-1 transition-all duration-200 font-mono"
                    >
                      CSV
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isExportingPdf || activeList.length === 0}
                    onClick={handleExportPdf}
                    className="text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded-none flex items-center gap-1 transition-all duration-200 font-mono"
                  >
                    PDF
                  </button>

                  <button
                    type="button"
                    disabled={activeList.length === 0}
                    onClick={handleExportWord}
                    className="text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded-none flex items-center gap-1 transition-all duration-200 font-mono"
                  >
                    Word
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {((activeTab === "shortlist" && rankedResults.length > 0) || 
          (activeTab === "pools" && selectedPoolId && poolCandidatesFiltered.length > 0)) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <div className="bg-slate-950/40 border border-slate-900 px-3 py-1 shadow-md shadow-black/10 rounded-none flex items-center justify-between">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">
                {activeTab === "shortlist" ? "Pool" : "Saved"}
              </span>
              <span className="text-sm font-bold font-mono text-slate-200">{stats.total}</span>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 px-3 py-1 shadow-md shadow-black/10 rounded-none flex items-center justify-between">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">Mean Fit</span>
              <span className="text-sm font-bold font-mono text-emerald">{stats.avgScore}%</span>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 px-3 py-1 shadow-md shadow-black/10 rounded-none flex items-center justify-between">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">Notice &le; 30d</span>
              <span className="text-sm font-bold font-mono text-cobalt">{stats.availablePct}%</span>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 px-3 py-1 shadow-md shadow-black/10 rounded-none flex items-center justify-between">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">Anomalies</span>
              <span className={`text-sm font-bold font-mono ${stats.anomalies > 0 ? "text-amber" : "text-slate-400"}`}>
                {stats.anomalies}
              </span>
            </div>
          </div>
        )}

        {/* Talent Pool Creation Panel moved to TalentPoolSidebar */}

        {(! (activeTab === "pools" && selectedPoolId === null)) && (
          <ResultsControls
            query={query}
            setQuery={setQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            viewMode={viewMode}
            setViewMode={setViewMode}
            activeTab={activeTab}
            availableOnly={availableOnly}
            setAvailableOnly={setAvailableOnly}
            githubOnly={githubOnly}
            setGithubOnly={setGithubOnly}
            anomalyFilter={anomalyFilter}
            setAnomalyFilter={setAnomalyFilter}
          />
        )}
      </div>

      {/* Accessibility: aria-live region for status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading
          ? "Ranking candidates, please wait..."
          : rankedResults.length > 0
          ? `${filtered.length} candidates ranked. ${stats.anomalies > 0 ? `${stats.anomalies} anomalies detected.` : ""}`
          : "No candidates ranked yet. Paste a job description and load candidates to begin."}
      </div>



      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/20"
      >
        {/* Loading state for shortlist — skeleton cards + staged phase messages */}
        {isLoading && activeTab === "shortlist" && (
          <div>
            <LoadingPhaseDisplay loadingPhase={loadingPhase} candidatesCount={candidates.length} />
            <div className="divide-y divide-slate-900 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="px-4 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded-none shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-2/3" />
                    <div className="h-2 bg-slate-900 rounded w-1/2" />
                  </div>
                  <div className="h-3 bg-slate-800 rounded w-12" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Talent Pools Grid (when no pool selected) */}
        {!isLoading && activeTab === "pools" && selectedPoolId === null && (
          <TalentPoolSidebar
            talentPools={talentPools}
            onSelectPoolId={setSelectedPoolId}
            onCreateTalentPool={onCreateTalentPool}
            onDeleteTalentPool={onDeleteTalentPool}
          />
        )}

        {/* Talent Pool Sub-Header */}
        {!isLoading && activeTab === "pools" && selectedPoolId !== null && (
          <div className="px-6 py-3 border-b border-slate-900/50 bg-slate-950/40 flex items-center justify-between font-mono shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedPoolId(null);
                setQuery(""); // reset search
              }}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <span>← Back to Talent Pools</span>
            </button>
            <div className="text-[10px] text-slate-500">
              Viewing Talent Pool: <strong className="text-slate-300 font-semibold">{talentPools.find(p => p.id === selectedPoolId)?.name}</strong>
            </div>
          </div>
        )}

        {/* Empty Lists States */}
        {!isLoading && candidates.length === 0 && activeTab === "shortlist" && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <svg className="w-16 h-16 text-slate-800 mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-slate-400 font-bold text-lg font-mono uppercase tracking-wider">No candidates ranked yet</h3>
            <p className="text-slate-600 text-xs mt-2 font-mono max-w-sm">
              Paste a Job Description and import a candidate JSON payload in the configuration panel to run the Discovery Matrix.
            </p>
          </div>
        )}

        {!isLoading && candidates.length > 0 && activeList.length === 0 && (activeTab === "shortlist" || selectedPoolId !== null) && (
          <div className="flex flex-col items-center justify-center p-12 text-center h-48">
            <svg className="h-8 w-8 text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-slate-400 font-semibold">
              {activeTab === "pools" ? "Talent pool is empty" : "No active candidates found"}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              {activeTab === "pools"
                ? "Classify candidate profiles into this talent pool from the discovery cards or details modal."
                : "Configure inputs or adjust filters to construct the candidate hierarchy."}
            </p>
          </div>
        )}

        {/* Results Matrix Render */}
        {!isLoading && activeList.length > 0 && (activeTab === "shortlist" || selectedPoolId !== null) && (
          viewMode === "podium" ? (
            activeList.length >= 3 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start max-w-5xl mx-auto py-8 px-6 font-mono">

                
                {/* Silver Column: Rank #2 (flanked left) */}
                <div className="md:order-1 md:pt-6">
                  {activeList[1] ? (
                    <div className="border border-slate-900 bg-slate-950/60 shadow-md hover:border-slate-800 transition-all duration-200 rounded-none">
                      <div className="flex items-center justify-between border-b border-slate-900 px-4 py-2 bg-slate-950">
                        <span className="text-[10px] font-bold text-slate-400">SILVER RANK #2</span>
                        <span className="text-xs font-bold text-emerald">
                          {(activeList[1].result.score <= 1 ? activeList[1].result.score * 100 : activeList[1].result.score).toFixed(1)}%
                        </span>
                      </div>
                      <CandidateCard
                        result={activeList[1].result}
                        candidate={activeList[1].candidate}
                        filteredRank={2}
                        onSelect={() => onSelectCandidate(activeList[1].result.candidate_id)}
                        talentPools={talentPools}
                        onOpenPoolManager={onOpenPoolManager}
                        inPoolView={activeTab === "pools"}
                        poolId={selectedPoolId}
                        onRemoveCandidateFromTalentPool={onRemoveCandidateFromTalentPool}
                        jobDescription={jobDescription}
                        isCompareSelected={compareIds.includes(activeList[1].result.candidate_id)}
                        onToggleCompare={handleToggleCompare}
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-900 p-8 text-center text-xs text-slate-700 italic rounded-none">
                      No candidate ranked #2 matches filters.
                    </div>
                  )}
                </div>

                {/* Gold Column: Rank #1 (highest, center) */}
                <div className="md:order-2">
                  {activeList[0] ? (
                    <div className="border-2 border-amber bg-slate-950/80 shadow-lg hover:border-amber/80 transition-all duration-200 relative rounded-none">
                      <div className="flex items-center justify-between border-b border-slate-900 px-4 py-3 bg-slate-950">
                        <span className="text-[10px] font-bold text-amber">GOLD RANK #1</span>
                        <span className="text-sm font-bold text-emerald">
                          {(activeList[0].result.score <= 1 ? activeList[0].result.score * 100 : activeList[0].result.score).toFixed(1)}%
                        </span>
                      </div>
                      <CandidateCard
                        result={activeList[0].result}
                        candidate={activeList[0].candidate}
                        filteredRank={1}
                        onSelect={() => onSelectCandidate(activeList[0].result.candidate_id)}
                        talentPools={talentPools}
                        onOpenPoolManager={onOpenPoolManager}
                        inPoolView={activeTab === "pools"}
                        poolId={selectedPoolId}
                        onRemoveCandidateFromTalentPool={onRemoveCandidateFromTalentPool}
                        jobDescription={jobDescription}
                        isCompareSelected={compareIds.includes(activeList[0].result.candidate_id)}
                        onToggleCompare={handleToggleCompare}
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-900 p-8 text-center text-xs text-slate-700 italic rounded-none">
                      No candidate ranked #1 matches filters.
                    </div>
                  )}
                </div>

                {/* Bronze Column: Rank #3 (flanked right) */}
                <div className="md:order-3 md:pt-12">
                  {activeList[2] ? (
                    <div className="border border-slate-900 bg-slate-950/60 shadow-md hover:border-slate-800 transition-all duration-200 rounded-none">
                      <div className="flex items-center justify-between border-b border-slate-900 px-4 py-2 bg-slate-950">
                        <span className="text-[10px] font-bold text-amber-700">BRONZE RANK #3</span>
                        <span className="text-xs font-bold text-emerald">
                          {(activeList[2].result.score <= 1 ? activeList[2].result.score * 100 : activeList[2].result.score).toFixed(1)}%
                        </span>
                      </div>
                      <CandidateCard
                        result={activeList[2].result}
                        candidate={activeList[2].candidate}
                        filteredRank={3}
                        onSelect={() => onSelectCandidate(activeList[2].result.candidate_id)}
                        talentPools={talentPools}
                        onOpenPoolManager={onOpenPoolManager}
                        inPoolView={activeTab === "pools"}
                        poolId={selectedPoolId}
                        onRemoveCandidateFromTalentPool={onRemoveCandidateFromTalentPool}
                        jobDescription={jobDescription}
                        isCompareSelected={compareIds.includes(activeList[2].result.candidate_id)}
                        onToggleCompare={handleToggleCompare}
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-900 p-8 text-center text-xs text-slate-700 italic rounded-none">
                      No candidate ranked #3 matches filters.
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center max-w-md mx-auto w-full">
                <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-none shadow-md w-full font-mono">
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Podium View Unavailable</p>
                  <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    Podium requires at least{" "}
                    <strong className="text-slate-300">3 candidates</strong>.
                    Currently showing{" "}
                    <strong className="text-emerald">{activeList.length}</strong>{" "}
                    candidate{activeList.length === 1 ? "" : "s"} — adjust filters or upload more data.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-900">
              {slicedList.map(({ result, candidate }, idx) => (
                <CandidateCard
                  key={result.candidate_id}
                  result={result}
                  candidate={candidate}
                  filteredRank={idx + 1}
                  onSelect={() => onSelectCandidate(result.candidate_id)}
                  talentPools={talentPools}
                  onOpenPoolManager={onOpenPoolManager}
                  inPoolView={activeTab === "pools"}
                  poolId={selectedPoolId}
                  onRemoveCandidateFromTalentPool={onRemoveCandidateFromTalentPool}
                  jobDescription={jobDescription}
                  isCompareSelected={compareIds.includes(result.candidate_id)}
                  onToggleCompare={handleToggleCompare}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Compare Modal */}
      {showCompareModal && compareIds.length >= 2 && (() => {
        const candidateMap = new Map(candidates.map((c) => [c.candidate_id, c]));
        const rankMap = new Map(rankedResults.map((r) => [r.candidate_id, r]));
        
        const selectedCandidates = compareIds.map(id => ({
          candidate: candidateMap.get(id),
          result: rankMap.get(id)
        })).filter(item => item.candidate && item.result);

        if (selectedCandidates.length < 2) return null;
        return (
          <Suspense fallback={null}>
            <CompareModal
              selectedCandidates={selectedCandidates}
              onClose={() => setShowCompareModal(false)}
            />
          </Suspense>
        );
      })()}
    </div>
  );
};

export default ResultsPanel;
