import { useRef, useState, useEffect } from "react";
import { parseJsonlFile } from "../utils/jsonlParser";

const InputPanel = ({
  jobDescription,
  setJobDescription,
  candidates,
  setCandidates,
  onRun,
  isLoading,
  error,
  setError,
}) => {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [parsedCount, setParsedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);

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
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium bg-amber/10 text-amber border border-amber/20 shadow-sm shadow-amber-500/10">
              <span className="h-1.5 w-1.5 rounded-full bg-amber"></span>
              Local Engine
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
        <div className="border border-slate-800/60 bg-slate-900/30 backdrop-blur-sm rounded-lg p-4 transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">Job Description Editor</span>
            <button
              type="button"
              onClick={loadDemoData}
              className="text-[11px] bg-gradient-to-r from-emerald to-teal-500 hover:from-emerald/90 hover:to-teal-500/90 text-midnight font-bold px-3 py-1 rounded transition-all duration-200 shadow-md shadow-emerald-500/10"
            >
              Load Hackathon Demo
            </button>
          </div>
          <textarea
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste job description text..."
            className="w-full min-h-[140px] resize-y rounded-md border border-slate-800/80 bg-slate-950/60 p-3 text-sm font-mono text-slate-200 focus:border-emerald/70 focus:ring-1 focus:ring-emerald/20 focus:outline-none transition-all duration-200 ease-in-out placeholder-slate-600"
          />
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border border-dashed rounded-lg p-5 transition-all duration-300 ease-in-out ${
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
