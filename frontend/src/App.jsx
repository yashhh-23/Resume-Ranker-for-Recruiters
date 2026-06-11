import { useMemo, useState, useEffect } from "react";
import InputPanel from "./components/InputPanel";
import ResultsPanel from "./components/ResultsPanel";
import CandidateModal from "./components/CandidateModal";
import ComplianceTray from "./components/ComplianceTray";
import TalentPoolAddModal from "./components/TalentPoolAddModal";
import PassphraseGate from "./components/PassphraseGate";
import { rankCandidates } from "./api/rankApi";
import { computeFallbackRanking, normalizeRankedResults } from "./utils/scoreUtils";
import {
  getTalentPools,
  createTalentPool,
  deleteTalentPool,
  addCandidateToTalentPool,
  removeCandidateFromTalentPool,
  setPassphrase,
  clearPassphrase,
} from "./utils/talentPoolUtils";

const App = () => {
  // ─── Auth gate ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleAuthenticate = (phrase) => {
    setPassphrase(phrase);           // store passphrase in memory only
    setTalentPools(getTalentPools()); // decrypt & load this recruiter's pools
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    clearPassphrase();
    setIsAuthenticated(false);
    setTalentPools([]);
    setJobDescription("");
    setCandidates([]);
    setRankedResults([]);
    setSelectedCandidateId(null);
    setPoolCandidate(null);
  };

  // ─── Main state ───────────────────────────────────────────────────────────
  const [jobDescription, setJobDescription] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [rankedResults, setRankedResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [talentPools, setTalentPools] = useState([]);
  const [poolCandidate, setPoolCandidate] = useState(null);

  // Talent pools are loaded after authentication — no automatic load on mount

  const handleCreateTalentPool = (name, autoAddCandidate = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    let updated = createTalentPool(trimmed);
    if (autoAddCandidate) {
      const newPool = updated.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
      if (newPool) {
        updated = addCandidateToTalentPool(newPool.id, autoAddCandidate.candidate, autoAddCandidate.result);
      }
    }
    setTalentPools(updated);
  };

  const handleDeleteTalentPool = (poolId) => {
    const updated = deleteTalentPool(poolId);
    setTalentPools(updated);
  };

  const handleAddCandidateToTalentPool = (poolId, candidate, result) => {
    const updated = addCandidateToTalentPool(poolId, candidate, result);
    setTalentPools(updated);
  };

  const handleRemoveCandidateFromTalentPool = (poolId, candidateId) => {
    const updated = removeCandidateFromTalentPool(poolId, candidateId);
    setTalentPools(updated);
  };

  const handleOpenPoolManager = (candidate, result, e) => {
    if (e) e.stopPropagation();
    setPoolCandidate({ candidate, result });
  };

  // Dynamic layout resizing states
  const [leftWidth, setLeftWidth] = useState(40); // left panel width in percentage (default 40%)
  const [trayHeight, setTrayHeight] = useState(160); // compliance tray height in pixels (default 160px)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1280);
  const [activeMobileTab, setActiveMobileTab] = useState("input"); // "input" | "results" on mobile

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1280);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startResizingWidth = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = leftWidth;

    const doDrag = (mouseMoveEvent) => {
      const deltaX = mouseMoveEvent.clientX - startX;
      const deltaPct = (deltaX / window.innerWidth) * 100;
      const newWidth = Math.max(20, Math.min(60, startWidth + deltaPct)); // restrict between 20% and 60%
      setLeftWidth(newWidth);
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const startResizingHeight = (mouseDownEvent) => {
    mouseDownEvent.preventDefault();
    const startY = mouseDownEvent.clientY;
    const startHeight = trayHeight;

    const doDrag = (mouseMoveEvent) => {
      const deltaY = mouseMoveEvent.clientY - startY;
      const newHeight = Math.max(80, Math.min(400, startHeight - deltaY)); // restrict between 80px and 400px
      setTrayHeight(newHeight);
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const candidateMap = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.candidate_id, candidate])),
    [candidates]
  );

  const selectedCandidate = selectedCandidateId
    ? candidateMap.get(selectedCandidateId)
    : null;
  const selectedResult = selectedCandidateId
    ? rankedResults.find((result) => result.candidate_id === selectedCandidateId)
    : null;

  const handleRun = async () => {
    if (!jobDescription.trim() || candidates.length === 0) {
      setError("Job description and candidates are required.");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const results = await rankCandidates({
        jobDescription,
        candidates,
      });
      setRankedResults(normalizeRankedResults(results, candidates));
      
      // Auto switch to results on mobile after a run completes
      if (!isDesktop) {
        setActiveMobileTab("results");
      }
    } catch (err) {
      const fallback = computeFallbackRanking(candidates);
      setRankedResults(fallback);
      setError(
        err instanceof Error
          ? `API unavailable. Loaded local ranking. ${err.message}`
          : "API unavailable. Loaded local ranking."
      );
      if (!isDesktop) {
        setActiveMobileTab("results");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Passphrase gate ─────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <PassphraseGate onAuthenticate={handleAuthenticate} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-midnight flex flex-col">
      {/* Mobile Tab Switcher + Logout */}
      {!isDesktop && (
        <div className="flex bg-slate-950 border-b border-borderline h-12 shrink-0">
          <button
            type="button"
            onClick={() => setActiveMobileTab("input")}
            className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeMobileTab === "input"
                ? "bg-slate-900 text-emerald border-b-2 border-b-emerald"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Configure Matrix</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-slate-950 border border-slate-800 text-slate-400 font-mono">
              {candidates.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab("results")}
            className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeMobileTab === "results"
                ? "bg-slate-900 text-emerald border-b-2 border-b-emerald"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Ranked Shortlist</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-slate-950 border border-slate-800 text-slate-400 font-mono">
              {rankedResults.length}
            </span>
          </button>
          {/* Logout / switch workspace */}
          <button
            type="button"
            id="logout-btn"
            onClick={handleLogout}
            title="Lock workspace & switch passphrase"
            className="px-3 text-slate-500 hover:text-emerald-400 transition-colors text-lg"
          >
            🔒
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className={`flex-1 min-h-0 ${isDesktop ? "flex flex-row" : "relative"}`}>
        {isDesktop ? (
          <>
            {/* Left Column (Inputs) */}
            <section
              className="h-full border-r border-borderline bg-canvas/80 shrink-0"
              style={{ width: `${leftWidth}%` }}
            >
              <InputPanel
                jobDescription={jobDescription}
                setJobDescription={setJobDescription}
                candidates={candidates}
                setCandidates={setCandidates}
                onRun={handleRun}
                isLoading={isLoading}
                error={error}
                setError={setError}
              />
            </section>

            {/* Vertical Resizer Handle */}
            <div
              onMouseDown={startResizingWidth}
              className="w-1 cursor-col-resize bg-slate-900 border-x border-slate-950 hover:bg-emerald/75 transition-colors h-full flex items-center justify-center relative z-20 group shrink-0"
              title="Drag horizontally to resize panels"
            >
              <div className="absolute h-10 w-1 rounded-full bg-slate-700 group-hover:bg-emerald transition-colors" />
            </div>

            {/* Right Column (Results + Compliance) */}
            <section
              className="h-full flex flex-col min-h-0 overflow-hidden"
              style={{ width: `${100 - leftWidth}%` }}
            >
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ResultsPanel
                  rankedResults={rankedResults}
                  candidates={candidates}
                  isLoading={isLoading}
                  onSelectCandidate={setSelectedCandidateId}
                  jobDescription={jobDescription}
                  talentPools={talentPools}
                  onOpenPoolManager={handleOpenPoolManager}
                  onCreateTalentPool={handleCreateTalentPool}
                  onDeleteTalentPool={handleDeleteTalentPool}
                  onRemoveCandidateFromTalentPool={handleRemoveCandidateFromTalentPool}
                />
              </div>

              {/* Horizontal Resizer Handle */}
              <div
                onMouseDown={startResizingHeight}
                className="h-1 cursor-row-resize bg-slate-900 border-y border-slate-950 hover:bg-emerald/75 transition-colors w-full flex items-center justify-center relative z-20 group shrink-0"
                title="Drag vertically to resize Compliance details"
              >
                <div className="absolute w-12 h-1 rounded-full bg-slate-700 group-hover:bg-emerald transition-colors" />
              </div>

              {/* Compliance Details Container */}
              <ComplianceTray rankedResults={rankedResults} trayHeight={trayHeight} />
            </section>
          </>
        ) : (
          /* Mobile Layout Workspace */
          <div className="absolute inset-0 flex flex-col min-h-0 overflow-hidden">
            {activeMobileTab === "input" ? (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <InputPanel
                  jobDescription={jobDescription}
                  setJobDescription={setJobDescription}
                  candidates={candidates}
                  setCandidates={setCandidates}
                  onRun={handleRun}
                  isLoading={isLoading}
                  error={error}
                  setError={setError}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ResultsPanel
                    rankedResults={rankedResults}
                    candidates={candidates}
                    isLoading={isLoading}
                    onSelectCandidate={setSelectedCandidateId}
                    jobDescription={jobDescription}
                    talentPools={talentPools}
                    onOpenPoolManager={handleOpenPoolManager}
                    onCreateTalentPool={handleCreateTalentPool}
                    onDeleteTalentPool={handleDeleteTalentPool}
                    onRemoveCandidateFromTalentPool={handleRemoveCandidateFromTalentPool}
                  />
                </div>
                {/* Collapsible compliance details for mobile */}
                <details className="shrink-0 border-t border-borderline bg-slate-950 group">
                  <summary className="px-4 py-3 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:bg-slate-900/60 flex justify-between items-center select-none">
                    <span>Technical Trace (Compliance)</span>
                    <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform duration-200">▼</span>
                  </summary>
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar bg-canvas">
                    <ComplianceTray rankedResults={rankedResults} />
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCandidate && (
        <CandidateModal
          candidate={selectedCandidate}
          result={selectedResult}
          onClose={() => setSelectedCandidateId(null)}
          talentPools={talentPools}
          onOpenPoolManager={handleOpenPoolManager}
        />
      )}

      {poolCandidate && (
        <TalentPoolAddModal
          poolCandidate={poolCandidate}
          talentPools={talentPools}
          onClose={() => setPoolCandidate(null)}
          onCreateTalentPool={handleCreateTalentPool}
          onAddCandidateToTalentPool={handleAddCandidateToTalentPool}
          onRemoveCandidateFromTalentPool={handleRemoveCandidateFromTalentPool}
        />
      )}
    </div>
  );
};

export default App;
