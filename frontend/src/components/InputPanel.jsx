import { useRef, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { parseJsonlFile } from "../utils/jsonlParser";
import { extractJdSkills } from "../utils/jdUtils";
import ExpandableTagList from "./ExpandableTagList";


const InputPanel = ({
  jobDescription,
  setJobDescription,
  candidates,
  setCandidates,
  onRun,
  isLoading,
  error,
  setError,
  jdParsed = null, // parsed JD from backend after first run
}) => {
  const fileInputRef = useRef(null);
  const [localJD, setLocalJD] = useState(jobDescription);
  const [fileName, setFileName] = useState("");
  const [parsedCount, setParsedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);

  useEffect(() => {
    setLocalJD(jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localJD !== jobDescription) {
        setJobDescription(localJD);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localJD, jobDescription, setJobDescription]);

  useEffect(() => {
    const checkHealth = async () => {
      const baseUrl = import.meta.env.VITE_API_URL;
      if (!baseUrl) {
        setApiOnline(false);
        return;
      }
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }
      } catch (e) {
        setApiOnline(false);
      }
    };
    checkHealth();
  }, []);

  const loadDemoData = async () => {
    setError(null);
    setIsParsing(true);
    setFileName("sample_candidates.json (Demo)");
    setParsedCount(0);
    try {
      setJobDescription(
        "We are looking for a Backend Engineer / Data Engineer hybrid to join our team. The ideal candidate will have 5+ years of experience building scalable data pipelines, streaming applications, and robust backend systems.\n\nKey Qualifications:\n- Strong proficiency in SQL, Python, and Apache Spark\n- Experience with workflow orchestration tools like Airflow or Apache Beam\n- Familiarity with cloud platforms (AWS/GCP/Azure) and data warehousing (Snowflake/BigQuery)\n- Experience deploying or fine-tuning machine learning models (NLP, LLMs, computer vision) is highly preferred\n- Strong problem-solving skills and collaborative mindset"
      );

      const response = await fetch("/sample_candidates.json");
      if (!response.ok) {
        throw new Error(`Failed to load demo data: ${response.statusText}`);
      }
      const data = await response.json();
      setCandidates(data);
      setParsedCount(data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load demo data.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) {
      return;
    }

    const isSupported =
      file.name.endsWith(".json") ||
      file.name.endsWith(".jsonl") ||
      file.name.endsWith(".jsonl.gz");
    if (!isSupported) {
      setError("Only .json, .jsonl, or .jsonl.gz files are supported.");
      return;
    }

    setError(null);
    setIsParsing(true);
    setFileName(file.name);
    setParsedCount(0);

    try {
      const { items, truncated } = await parseJsonlFile(file, {
        onProgress: (count) => setParsedCount(count),
      });

      setCandidates(items);
      if (truncated) {
        setError("Input capped at 100000 records for performance safeguards.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse file.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 gap-6 bg-slate-950/20 backdrop-blur-md">
      <div className="flex justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-mono">Redrob Console</p>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Discovery & Ranking
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Configure the discovery matrix with job description signals and ingest candidate feeds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apiOnline === true && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-emerald/10 text-emerald border border-emerald/20 shadow-sm shadow-emerald-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse"></span>
              API Connected
            </span>
          )}
          {apiOnline === false && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-amber/10 text-amber border border-amber/20 shadow-sm shadow-amber-500/10 group/status relative cursor-help"
              title="Using local CPU inference model (all-MiniLM-L6-v2) for offline-capable semantic ranking"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber"></span>
              Local Engine
              <div className="absolute hidden group-hover/status:block z-50 right-0 top-full mt-2 w-56 p-2.5 bg-slate-950 border border-slate-800 text-[10px] text-slate-400 font-mono shadow-xl rounded-none normal-case leading-normal">
                Using <strong className="text-white">all-MiniLM-L6-v2</strong>: optimized CPU inference, 5x faster than standard BERT.
              </div>
            </span>
          )}
          {apiOnline === null && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-cobalt/10 text-cobalt border border-cobalt/20">
              <span className="h-1.5 w-1.5 rounded-full bg-cobalt animate-ping"></span>
              Connecting...
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
        {/* Collapsible Onboarding / Differentiation Section */}
        <details className="border border-slate-800/60 bg-slate-900/10 rounded-lg group transition-all duration-300 hover:border-slate-700/60">
          <summary className="px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 cursor-pointer flex justify-between items-center select-none">
            <span className="flex items-center gap-1.5 text-emerald">
              <svg className="h-3.5 w-3.5 text-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why RRR? (ATS vs Semantic Ranking)
            </span>
            <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform duration-200">▼</span>
          </summary>
          <div className="px-4 pb-4 pt-1 text-xs font-mono text-slate-400 space-y-2 border-t border-slate-900/50 mt-1 leading-relaxed">
            <p>
              Traditional applicant tracking systems (ATS) rely on simple keyword matches, which are easily gamed and miss qualified candidates using synonyms.
            </p>
            <p>
              <strong className="text-white">RRR uses Multi-Dimensional Context Matching:</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-500">
              <li><strong className="text-emerald">Zero Hallucination:</strong> Strict deterministic evaluation based on local profile data.</li>
              <li><strong className="text-cobalt">5-Dimensional Model:</strong> Ranks candidates across Skill Match, Career Fit, Activity Modifiers, Education Tiers, and operational Availability.</li>
              <li><strong className="text-indigo-400">Deep Embeddings:</strong> Automatically maps context (e.g. "ML" to "Machine Learning").</li>
            </ul>
          </div>
        </details>

        {/* Collapsible JD Parse Preview Panel */}
        {localJD.trim() && (
          <details className="border border-slate-800/60 bg-slate-900/10 rounded-lg group transition-all duration-300 hover:border-slate-700/60" open>
            <summary className="px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-400 cursor-pointer flex justify-between items-center select-none">
              <span className="flex items-center gap-1.5 text-[#14B8A6]">
                <svg className="h-3.5 w-3.5 text-[#14B8A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Parsed JD Preview
                {jdParsed && (
                  <span className="ml-1 px-1.5 py-0.5 bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[9px] rounded font-bold text-[#14B8A6]">
                    Backend ✓
                  </span>
                )}
              </span>
              <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform duration-200">▼</span>
            </summary>
            <div className="px-4 pb-4 pt-1 text-xs font-mono text-slate-400 space-y-3 border-t border-slate-900/50 mt-1">
              {jdParsed ? (
                /* Backend-parsed JD data */
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Seniority</span>
                      <span className="text-white font-bold uppercase text-[11px]">{jdParsed.seniority_level || "Mid-Senior"}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-slate-500">Min Experience</span>
                      <span className="text-white font-bold text-[11px]">{jdParsed.min_experience_years ? `${jdParsed.min_experience_years}+ yrs` : "Not specified"}</span>
                    </div>
                    {jdParsed.target_title && (
                      <div className="flex flex-col gap-0.5 col-span-2">
                        <span className="text-[10px] text-slate-500">Target Title</span>
                        <span className="text-white font-bold text-[11px]">{jdParsed.target_title}</span>
                      </div>
                    )}
                    {(jdParsed.target_industry || jdParsed.target_field) && (
                      <div className="flex flex-col gap-0.5 col-span-2">
                        <span className="text-[10px] text-slate-500">Domain / Field</span>
                        <span className="text-white font-bold text-[11px]">{[jdParsed.target_field, jdParsed.target_industry].filter(Boolean).join(" / ")}</span>
                      </div>
                    )}
                  </div>
                  {jdParsed.required_skills?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-emerald font-bold block flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald inline-block" />
                        Required Skills ({jdParsed.required_skills.length})
                      </span>
                      <ExpandableTagList
                        items={jdParsed.required_skills}
                        limit={10}
                        label="Required Skills"
                        accentColor="#10B981"
                        renderItem={(token) => (
                          <span key={token} className="px-2 py-0.5 bg-emerald/10 border border-emerald/30 text-[10px] text-emerald rounded font-semibold">
                            {token}
                          </span>
                        )}
                      />
                    </div>
                  )}
                  {jdParsed.preferred_skills?.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-cobalt font-bold block flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cobalt inline-block" />
                        Preferred Skills ({jdParsed.preferred_skills.length})
                      </span>
                      <ExpandableTagList
                        items={jdParsed.preferred_skills}
                        limit={8}
                        label="Preferred Skills"
                        accentColor="#3B82F6"
                        renderItem={(token) => (
                          <span key={token} className="px-2 py-0.5 bg-cobalt/10 border border-cobalt/30 text-[10px] text-cobalt rounded font-semibold">
                            {token}
                          </span>
                        )}
                      />
                    </div>
                  )}
                </>
              ) : (
                /* Heuristic pre-run preview */
                <>
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-900/50 pb-2">
                    <span>Seniority Level:</span>
                    <span className="text-white font-bold uppercase">
                      {localJD.toLowerCase().includes("senior") || localJD.toLowerCase().includes("lead") || localJD.toLowerCase().includes("principal")
                        ? "Senior / Lead"
                        : localJD.toLowerCase().includes("junior")
                        ? "Junior"
                        : "Mid-Senior"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] border-b border-slate-900/50 pb-2">
                    <span>Domain Focus:</span>
                    <span className="text-white font-bold capitalize">
                      {(() => {
                        const text = localJD.toLowerCase();
                        const domains = [];
                        if (text.includes("backend")) domains.push("Backend");
                        if (text.includes("frontend")) domains.push("Frontend");
                        if (text.includes("data engineer") || text.includes("spark") || text.includes("pipeline")) domains.push("Data Engineering");
                        if (text.includes("machine learning") || text.includes("ml") || text.includes("nlp") || text.includes("vision")) domains.push("AI/ML");
                        return domains.join(" / ") || "General Engineering";
                      })()}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 block">Extracted Skill Tokens (heuristic — run for precise parsing):</span>
                    <ExpandableTagList
                      items={extractJdSkills(localJD)}
                      limit={10}
                      label="Extracted Skill Tokens"
                      accentColor="#94a3b8"
                      renderItem={(token) => (
                        <span key={token} className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded font-semibold">
                          {token}
                        </span>
                      )}
                    />
                  </div>
                </>
              )}
            </div>
          </details>
        )}

        <div className="border border-slate-800/60 bg-slate-900/30 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">Job Description Editor</span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold font-mono tracking-wider bg-emerald/10 border border-emerald/30 text-emerald px-1.5 py-0.5 rounded">
                Zero Setup
              </span>
              <button
                type="button"
                onClick={loadDemoData}
                className="text-[11px] bg-gradient-to-r from-emerald to-teal-500 hover:from-emerald/90 hover:to-teal-500/90 text-midnight font-bold px-3 py-1 rounded transition-all duration-200 shadow-md shadow-emerald-500/10"
              >
                Load Hackathon Demo
              </button>
            </div>
          </div>
          <textarea
            value={localJD}
            onChange={(event) => setLocalJD(event.target.value)}
            placeholder="Paste job description text..."
            onKeyDown={(event) => {
              if (event.ctrlKey && event.key === "Enter") {
                event.preventDefault();
                flushSync(() => {
                  setJobDescription(localJD);
                });
                if (!isLoading && candidates.length > 0) {
                  onRun();
                }
              }
            }}
            className="w-full min-h-[140px] resize-y rounded-md border border-slate-800/80 bg-slate-950/60 p-3 text-sm font-mono text-slate-200 focus:border-emerald/70 focus:ring-1 focus:ring-emerald/20 focus:outline-none transition-all duration-200 ease-in-out placeholder-slate-600"
          />
          {(() => {
            const JD_MAX = 5000;
            const charCount = localJD?.length || 0;
            const isNearLimit = charCount > JD_MAX * 0.9;
            return (
              <div className="flex justify-end text-[10px] font-mono mt-1 select-none">
                <span className={isNearLimit ? "text-amber-400 font-semibold" : "text-slate-600"}>
                  {charCount.toLocaleString()} / {JD_MAX.toLocaleString()} chars
                </span>
              </div>
            );
          })()}
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Drag and drop candidate dataset, or select file by clicking Browse button"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`border border-dashed rounded-lg p-5 transition-all duration-300 ease-in-out focus:outline-none focus:ring-1 focus:ring-emerald/50 ${
            isDragging
              ? "border-emerald bg-emerald/5 shadow-inner"
              : "border-slate-800 bg-slate-900/30 hover:border-slate-700/60"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-md border border-slate-800/80 bg-slate-950/70 flex items-center justify-center shadow-md">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
                  stroke={isDragging ? "#10B981" : "#64748B"}
                  strokeWidth="1.4"
                  className="transition-colors duration-300"
                />
                <path d="M13 3v5h5" stroke={isDragging ? "#10B981" : "#64748B"} strokeWidth="1.4" className="transition-colors duration-300" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-200">Data Stream Ingestion Node</p>
              <p className="text-xs text-slate-500">
                Drag & drop candidate dataset (.json, .jsonl, .jsonl.gz).
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs uppercase tracking-[0.2em] px-3 py-2 rounded border border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:border-slate-600 hover:bg-slate-800 transition-all duration-200 ease-in-out"
            >
              Browse
            </button>
          </div>

          <div className="mt-4 border-t border-slate-900 pt-3 text-[11px] font-mono text-slate-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Ingested File:</span>
              <span className={fileName ? "text-slate-300 font-medium" : "text-slate-600"}>{fileName || "None"}</span>
            </div>
            <div className="flex justify-between">
              <span>Parsed Stream Count:</span>
              <span className="text-emerald font-semibold">{parsedCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Valid Active Profiles:</span>
              <span className="text-slate-300 font-semibold">{candidates.length}</span>
            </div>
            {isParsing && (
              <div className="flex items-center gap-1.5 text-cobalt animate-pulse mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-cobalt"></span>
                <span>Decompressing & analyzing streams...</span>
              </div>
            )}
          </div>

          <input
            id="candidate-file-input"
            aria-label="Upload candidate dataset in JSON, JSONL, or GZ format"
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl,.jsonl.gz"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {error && (
          <div className="border border-amber/40 bg-amber/5 rounded-md p-3 text-xs text-amber font-mono flex items-start gap-2 animate-pulse">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!error && !isParsing && parsedCount > 0 && (
          <div className="border border-emerald/40 bg-emerald/5 rounded-md p-3 text-xs text-emerald font-mono flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>✅ {parsedCount} profiles parsed & validated successfully. Ready for Discovery Matrix evaluation.</span>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isLoading || candidates.length === 0}
        onClick={onRun}
        className="w-full relative group overflow-hidden rounded-md bg-gradient-to-r from-emerald to-teal-500 hover:from-emerald hover:to-teal-400 text-midnight text-sm font-bold py-3.5 tracking-[0.2em] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
      >
        <span className="relative z-10">
          {isLoading ? "EXECUTING DISCOVERY MATRIX..." : "RUN CANDIDATE DISCOVERY MATRIX"}
        </span>
      </button>
    </div>
  );
};

export default InputPanel;
