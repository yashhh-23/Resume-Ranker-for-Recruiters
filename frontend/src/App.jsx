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

// ─── SVG Themed Icons ────────────────────────────────────────────────────────
const ShieldIcon = ({ className = "h-5 w-5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LockIcon = ({ className = "h-3.5 w-3.5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SunIcon = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const App = () => {
  // ─── Auth gate ────────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  // Keep-alive ping to prevent backend cold start on Render.com
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return;
    const ping = () => fetch(`${apiUrl}/health`).catch(() => {});
    ping(); // warm up immediately on app load
    const interval = setInterval(ping, 9 * 60 * 1000); // ping every 9 minutes
    return () => clearInterval(interval);
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
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
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
          jobDescription={jobDescription}
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
