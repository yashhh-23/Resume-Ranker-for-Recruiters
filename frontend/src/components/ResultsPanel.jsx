import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import CandidateCard from "./CandidateCard";
import { detectTimelineAnomaly } from "../utils/scoreUtils";
import { exportPdfReport, exportWordReport } from "../utils/reportGenerator";
import { exportSubmissionCsv } from "../utils/exportCsv";
import LoadingPhaseDisplay from "./LoadingPhaseDisplay";
import TalentPoolSidebar from "./TalentPoolSidebar";
import ResultsControls from "./ResultsControls";

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
}) => {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("rank");
  const [anomalyFilter, setAnomalyFilter] = useState("all"); // "all" | "only" | "exclude"
  const [availableOnly, setAvailableOnly] = useState(false);
  const [githubOnly, setGithubOnly] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "podium"

  // Compare mode
  const [compareIds, setCompareIds] = useState([]); // up to 2 candidate_ids
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Staged loading messages
  const [loadingPhase, setLoadingPhase] = useState(0);

  useEffect(() => {
    if (!isLoading) { setLoadingPhase(0); return; }
    const t1 = setTimeout(() => setLoadingPhase(1), 1800);
    const t2 = setTimeout(() => setLoadingPhase(2), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
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

  const filtered = useMemo(() => {
    const candidateMap = new Map(
      candidates.map((candidate) => [candidate.candidate_id, candidate])
    );

    const search = query.trim().toLowerCase();
    let itemsList = rankedResults.map((result) => ({
      result,
      candidate: candidateMap.get(result.candidate_id),
    }));

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

    itemsList = itemsList.filter((row) => {
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

    itemsList.sort((a, b) => {
      if (sortBy === "experience") {
        const expA = a.candidate?.profile?.years_of_experience || 0;
        const expB = b.candidate?.profile?.years_of_experience || 0;
        return expB - expA;
      }
      if (sortBy === "notice") {
        const noticeA = a.candidate?.redrob_signals?.notice_period_days ?? 999;
        const noticeB = b.candidate?.redrob_signals?.notice_period_days ?? 999;
        return noticeA - noticeB;
      }
      if (sortBy === "completeness") {
        const compA = a.candidate?.redrob_signals?.profile_completeness_score || 0;
        const compB = b.candidate?.redrob_signals?.profile_completeness_score || 0;
        return compB - compA;
      }
      if (sortBy === "skills") {
        const skillsA = a.candidate?.skills?.length || 0;
        const skillsB = b.candidate?.skills?.length || 0;
        return skillsB - skillsA;
      }
      return (a.result.rank || 0) - (b.result.rank || 0);
    });

    return itemsList;
  }, [rankedResults, candidates, query, sortBy, anomalyFilter, availableOnly, githubOnly]);

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

    list = [...list].sort((a, b) => {
      if (sortBy === "experience") {
        const expA = a.candidate?.profile?.years_of_experience || 0;
        const expB = b.candidate?.profile?.years_of_experience || 0;
        return expB - expA;
      }
      if (sortBy === "notice") {
        const noticeA = a.candidate?.redrob_signals?.notice_period_days ?? 999;
        const noticeB = b.candidate?.redrob_signals?.notice_period_days ?? 999;
        return noticeA - noticeB;
      }
      if (sortBy === "completeness") {
        const compA = a.candidate?.redrob_signals?.profile_completeness_score || 0;
        const compB = b.candidate?.redrob_signals?.profile_completeness_score || 0;
        return compB - compA;
      }
      if (sortBy === "skills") {
        const skillsA = a.candidate?.skills?.length || 0;
        const skillsB = b.candidate?.skills?.length || 0;
        return skillsB - skillsA;
      }
      return (
        (a.result.rank === "-" ? 999 : Number(a.result.rank || 999)) -
        (b.result.rank === "-" ? 999 : Number(b.result.rank || 999))
      );
    });

    return list;
  }, [activeTab, selectedPoolId, talentPools, query, sortBy]);

  const activeList =
    activeTab === "pools" && selectedPoolId
      ? poolCandidatesFiltered
      : filtered;

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
      <div className="px-4 py-4 sm:px-6 sm:pt-6 sm:pb-4 border-b border-borderline/80 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-mono">
              {activeTab === "shortlist" ? "Shortlist Console" : "Talent Pool Console"}
            </p>
            <h2 className="text-xl font-bold text-white mt-1">
              {activeTab === "shortlist" ? "Ranked Shortlist" : "Talent Pools"}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            {/* Pools vs Shortlist Tab Switcher */}
            <div className="flex border border-slate-800 bg-slate-950 p-0.5 rounded-none shrink-0 font-mono">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("shortlist");
                  setSelectedPoolId(null);
                }}
                className={`px-3.5 py-1.5 text-xs transition-all duration-200 rounded-none font-bold uppercase tracking-wider ${
                  activeTab === "shortlist"
                    ? "bg-slate-800 text-slate-100 font-bold border border-slate-700"
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
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
                className={`px-3.5 py-1.5 text-xs transition-all duration-200 rounded-none font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  activeTab === "pools"
                    ? "bg-slate-800 text-slate-100 font-bold border border-slate-700"
                    : "text-slate-500 hover:text-slate-300 border border-transparent"
                }`}
              >
                <span>Talent Pools</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-950 border border-slate-800 text-slate-400">
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
                  className="text-[11px] bg-amber/10 border border-amber/40 hover:bg-amber/20 text-amber font-bold px-3 py-1.5 rounded-none flex items-center gap-1.5 transition-all duration-200 font-mono animate-pulse"
                  title={`Compare ${compareIds.length} selected candidates`}
                >
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Compare {compareIds.length}
                </button>
              )}
              {compareIds.length > 0 && activeTab === "shortlist" && (
                <span className="text-[10px] font-mono text-amber border border-amber/20 px-2.5 py-1 rounded-none bg-amber/5">
                  {compareIds.length}/3 selected for compare
                </span>
              )}

              {((activeTab === "shortlist" && rankedResults.length > 0) ||
                (activeTab === "pools" && selectedPoolId && poolCandidatesFiltered.length > 0)) && (
                <>
                  <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs rounded-none">
                    {activeList.length} matching
                  </span>

                  {/* CSV Export — hackathon submission format */}
                  {activeTab === "shortlist" && (
                    <button
                      type="button"
                      disabled={rankedResults.length === 0}
                      onClick={() => exportSubmissionCsv(rankedResults)}
                      className="text-[11px] bg-emerald/10 border border-emerald/30 hover:bg-emerald/20 hover:border-emerald/50 text-emerald font-bold px-3 py-1.5 rounded-none flex items-center gap-1.5 transition-all duration-200 font-mono"
                      title="Download submission.csv (hackathon format: candidate_id, rank, score, reasoning)"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>CSV</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isExportingPdf || activeList.length === 0}
                    onClick={handleExportPdf}
                    className="text-[11px] bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-none flex items-center gap-1.5 transition-all duration-200 font-mono"
                    title="Export current filtered results as PDF"
                  >
                    <svg className="h-3.5 w-3.5 text-rose-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M9 12h1.5a1.5 1.5 0 0 0 0-3H9v6" />
                    </svg>
                    <span>{isExportingPdf ? "PDF..." : "PDF"}</span>
                  </button>

                  <button
                    type="button"
                    disabled={activeList.length === 0}
                    onClick={handleExportWord}
                    className="text-[11px] bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-bold px-3 py-1.5 rounded-none flex items-center gap-1.5 transition-all duration-200 font-mono"
                    title="Export current filtered results as Word Document"
                  >
                    <svg className="h-3.5 w-3.5 text-cobalt shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M8 12l2 4 2-4 2 4 2-4" />
                    </svg>
                    <span>Word</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {((activeTab === "shortlist" && rankedResults.length > 0) || 
          (activeTab === "pools" && selectedPoolId && poolCandidatesFiltered.length > 0)) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-950/40 border border-slate-900 p-3 shadow-md shadow-black/10 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                {activeTab === "shortlist" ? "Ingested Pool" : "Saved Candidates"}
              </p>
              <p className="text-lg font-bold font-mono text-slate-200 mt-1">{stats.total}</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 p-3 shadow-md shadow-black/10 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Mean Fit Score</p>
              <p className="text-lg font-bold font-mono text-emerald mt-1">{stats.avgScore}%</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 p-3 shadow-md shadow-black/10 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Notice &le; 30d</p>
              <p className="text-lg font-bold font-mono text-cobalt mt-1">{stats.availablePct}%</p>
            </div>
            <div className="bg-slate-950/40 border border-slate-900 p-3 shadow-md shadow-black/10 rounded-none">
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Anomalies Flagged</p>
              <p className={`text-lg font-bold font-mono mt-1 ${stats.anomalies > 0 ? "text-amber" : "text-slate-400"}`}>
                {stats.anomalies}
              </p>
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

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/20">
        {/* Loading state for shortlist — staged messages + skeleton cards */}
        {isLoading && activeTab === "shortlist" && (
          <LoadingPhaseDisplay loadingPhase={loadingPhase} />
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
            <div className="divide-y divide-slate-900">
              {activeList.map(({ result, candidate }) => (
                <CandidateCard
                  key={result.candidate_id}
                  result={result}
                  candidate={candidate}
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
