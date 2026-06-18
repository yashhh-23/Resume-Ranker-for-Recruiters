import { useMemo, useState, useEffect, lazy, Suspense } from "react";
import InputPanel from "./components/InputPanel";
import ResultsPanel from "./components/ResultsPanel";
import ComplianceTray from "./components/ComplianceTray";
import ResultsErrorBoundary from "./components/ResultsErrorBoundary";

const CandidateModal = lazy(() => import("./components/CandidateModal"));
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
import { ShieldIcon, LockIcon, SunIcon, MoonIcon } from "./components/icons";

const App = () => {
  // ─── Auth gate ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [showWeightsInfo, setShowWeightsInfo] = useState(false);

  // ─── Theme Mode ───────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("rrr_theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("rrr_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

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
    setJdParsed(null);
    setBackendProcessingMs(null);
  };

  const handleResetWorkspace = () => {
    setJobDescription("");
    setCandidates([]);
    setRankedResults([]);
    setSelectedCandidateId(null);
    setPoolCandidate(null);
    setError(null);
    setJdParsed(null);
    setBackendProcessingMs(null);
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
  const [executionTime, setExecutionTime] = useState(null);
  const [jdParsed, setJdParsed] = useState(null); // parsed JD from backend
  const [backendProcessingMs, setBackendProcessingMs] = useState(null);

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

  // Warm up backend connection on app load
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return;
    fetch(`${apiUrl.replace(/\/$/, "")}/health`).catch(() => {});
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
    const startTime = performance.now();

    try {
      const { results, meta } = await rankCandidates({
        jobDescription,
        candidates,
      });
      const endTime = performance.now();
      setExecutionTime(((endTime - startTime) / 1000).toFixed(2));
      if (meta?.jd_parsed) setJdParsed(meta.jd_parsed);
      if (meta?.processing_time_ms) setBackendProcessingMs(meta.processing_time_ms);
      setRankedResults(normalizeRankedResults(results, candidates));
      setRunCount((prev) => prev + 1);
      
      // Auto switch to results on mobile after a run completes
      if (!isDesktop) {
        setActiveMobileTab("results");
      }
    } catch (err) {
      const fallback = computeFallbackRanking(candidates);
      const endTime = performance.now();
      setExecutionTime(((endTime - startTime) / 1000).toFixed(2));
      setRankedResults(fallback);
      setRunCount((prev) => prev + 1);
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
      {/* Header Navigation Bar */}
      <header className="flex items-center justify-between px-6 bg-slate-950 border-b border-borderline h-14 shrink-0 font-mono">
        <div className="flex items-center gap-3">
          <ShieldIcon className="h-5 w-5 text-emerald shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">RRR Recruiter</h1>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block mt-0.5">Resume Ranker</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald/10 border border-emerald/20 text-emerald ml-2 animate-pulse">
            <LockIcon className="h-2.5 w-2.5 shrink-0" />
            <span>Encrypted Locally</span>
          </div>
          <div className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <span>⚡</span>
            <span>Zero LLM Hallucination</span>
          </div>
          <a
            href="https://github.com/yashhh-23/Resume-Ranker-for-Recruiters"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-white rounded transition-colors"
          >
            <span>GitHub Repo</span>
          </a>
          {/* Scoring Model Info Button — icon-only on mobile, full label on md+ */}
          <button
            type="button"
            onClick={() => setShowWeightsInfo(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-400 hover:text-emerald hover:border-emerald/30 rounded transition-colors"
            title="View scoring model weights"
            aria-label="View scoring model weights"
          >
            <span className="hidden md:inline">ℹ Scoring Model</span>
            <span className="md:hidden" aria-hidden="true">ℹ</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={theme === "light"}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-1.5 rounded-none border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 transition-all duration-200 flex items-center justify-center h-8 w-8"
          >
            {theme === "dark" ? <SunIcon className="h-4 w-4 shrink-0" /> : <MoonIcon className="h-4 w-4 shrink-0" />}
          </button>
          
          {/* Logout Button */}
          <button
            type="button"
            id="logout-btn"
            onClick={handleLogout}
            title="Lock workspace & switch passphrase"
            className="px-3 py-1.5 text-xs uppercase tracking-wider font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-none transition-all duration-200 flex items-center gap-2 h-8"
          >
            <LockIcon className="h-3 w-3 text-slate-400 group-hover:text-slate-200 shrink-0" />
            <span>Lock</span>
          </button>
        </div>
      </header>
      {/* Mobile Tab Switcher */}
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
                jdParsed={jdParsed}
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
                <ResultsErrorBoundary resetKey={runCount}>
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
                    executionTime={executionTime}
                    onReset={handleResetWorkspace}
                  />
                </ResultsErrorBoundary>
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
                  jdParsed={jdParsed}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <ResultsErrorBoundary resetKey={runCount}>
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
                      executionTime={executionTime}
                      onReset={handleResetWorkspace}
                    />
                  </ResultsErrorBoundary>
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
        <Suspense fallback={null}>
          <ResultsErrorBoundary resetKey={selectedCandidateId} candidateId={selectedCandidateId} candidateName={selectedCandidate?.profile?.anonymized_name}>
            <CandidateModal
              candidate={selectedCandidate}
              result={selectedResult}
              onClose={() => setSelectedCandidateId(null)}
              talentPools={talentPools}
              onOpenPoolManager={handleOpenPoolManager}
              jobDescription={jobDescription}
            />
          </ResultsErrorBoundary>
        </Suspense>
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

      {/* Scoring Model Info Modal */}
      {showWeightsInfo && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowWeightsInfo(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-950 border border-slate-800 shadow-2xl p-6 font-mono rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">RRR Scoring Engine</p>
                <h3 className="text-base font-bold text-white mt-0.5">5-Signal Weighted Scoring Model</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWeightsInfo(false)}
                className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
                aria-label="Close scoring model info"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Skill Match", weight: "35%", color: "#10B981", desc: "Semantic cosine similarity (all-MiniLM-L6-v2) + JD skill coverage + verified Redrob assessments" },
                { label: "Career Fit", weight: "25%", color: "#3B82F6", desc: "Job title alignment, industry match, experience threshold, career progression velocity" },
                { label: "Engagement Signals", weight: "15%", color: "#6366F1", desc: "GitHub activity score, recruiter response rate, platform assessment completions" },
                { label: "Education", weight: "15%", color: "#14B8A6", desc: "Institution tier (IIT/IIM/Tier-1/Tier-2), degree level, field-of-study relevance" },
                { label: "Availability", weight: "10%", color: "#D97706", desc: "Notice period days, open-to-work flag, relocation willingness" },
              ].map(({ label, weight, color, desc }) => (
                <div key={label} className="border border-slate-900 bg-slate-900/20 p-3 rounded-none">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold" style={{ color }}>{label}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 border rounded-none" style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}>{weight}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-900 text-[9px] text-slate-600 text-center">
              Zero LLM hallucination · Deterministic scoring · Model: sentence-transformers/all-MiniLM-L6-v2 · FAISS CPU flat L2 index
            </div>
          </div>
        </div>
      )}

      {/* Powered by Tech Strip Footer */}
      <footer className="bg-slate-950 border-t border-borderline h-8 shrink-0 flex items-center justify-between px-6 text-[10px] text-slate-500 font-mono select-none">
        <span>Powered by: <strong className="text-slate-400">Vite + React</strong> · <strong className="text-slate-400">all-MiniLM-L6-v2</strong> · Zero LLM · 5-Signal Weighted Scoring</span>
        <span className="flex items-center gap-3">
          {backendProcessingMs && (
            <span className="text-emerald/60">⚡ Last API: {backendProcessingMs}ms</span>
          )}
          <span>Team Chanakya · Redrob H2S Hackathon</span>
        </span>
      </footer>
    </div>
  );
};

export default App;
