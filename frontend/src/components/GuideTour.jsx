import { useState, useEffect, useCallback } from "react";

export const TOUR_KEY = "rrr_guide_tour_done_v1";

// ─── Tour step definitions ────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    id: "welcome",
    targetId: null,
    placement: "center",
    title: "Welcome to RRR Recruiter",
    subtitle: "Resume Ranker for Recruiters",
    body: "This guided tour walks you through the key features of the system. Navigate with the buttons below, jump to any step using the dots, or skip anytime.",
    icon: (
      <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.599 12c0 2.34.672 4.524 1.836 6.375M9.75 15.75A11.955 11.955 0 0112 21.001a11.955 11.955 0 012.25-5.251" />
      </svg>
    ),
  },
  {
    id: "header",
    targetId: "guide-target-header",
    placement: "bottom",
    title: "System Header",
    body: "The top bar shows the system name and status badges. 'Encrypted Locally' confirms AES-encrypted talent pool storage in your browser. The lock icon lets you switch recruiter profiles. The 'Guide' button reopens this tour anytime.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    id: "scoring-model",
    targetId: "guide-target-scoring-btn",
    placement: "bottom",
    title: "Scoring Model Info",
    body: "Click the 'Scoring Model' button to inspect the 5-signal weighted breakdown: Skill Match (35%), Career Fit (25%), Engagement Signals (15%), Education (15%), and Availability (10%). Understanding this helps you interpret candidate scores.",
    icon: (
      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
    ),
  },
  {
    id: "jd-editor",
    targetId: "guide-target-jd-editor",
    placement: "right",
    title: "Job Description Editor",
    body: "Paste or type your job description here. The system auto-extracts required skills, seniority level, and domain focus. Press Ctrl+Enter to trigger a run directly from this editor.",
    icon: (
      <svg className="h-5 w-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
      </svg>
    ),
  },
  {
    id: "demo-btn",
    targetId: "guide-target-demo-btn",
    placement: "bottom",
    title: "Load Hackathon Demo",
    body: "Click 'Load Hackathon Demo' to instantly populate the JD editor with a Senior AI Engineer description and ingest a sample candidate dataset. This is the fastest way to see the system in action.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
  {
    id: "file-upload",
    targetId: "guide-target-file-upload",
    placement: "right",
    title: "Candidate Data Ingestion",
    body: "Drag and drop a candidate dataset (.json, .jsonl, .jsonl.gz) or click 'Browse' to select. Supports up to 150,000 candidate profiles. The ingested count and validation status appear below the drop zone.",
    icon: (
      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
    ),
  },
  {
    id: "run-btn",
    targetId: "guide-target-run-btn",
    placement: "top",
    title: "Run Candidate Discovery Matrix",
    body: "Once JD and candidates are loaded, click this button to rank. The backend scores all candidates using all-MiniLM-L6-v2 semantic embeddings + 5-signal heuristics. Keyboard shortcut: Ctrl+Shift+R.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
  },
  {
    id: "results-header",
    targetId: "guide-target-results-header",
    placement: "bottom",
    title: "Ranked Shortlist Panel",
    body: "After a run, the right panel shows candidates sorted by fit score. Switch between 'Shortlist' and 'Pools' tabs. The stats grid shows total matches, Mean Fit %, candidates available within 30 days, and timeline anomaly count.",
    icon: (
      <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
      </svg>
    ),
  },
  {
    id: "candidate-card",
    targetId: null,
    placement: "center",
    title: "Candidate Cards",
    body: "Each card shows the candidate's anonymized name, headline, fit score, and key signals. Click any card to open the full profile modal with a detailed scoring breakdown, career history, education, and GitHub activity. Use the bookmark icon to save to a Talent Pool.",
    icon: (
      <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
  {
    id: "export",
    targetId: null,
    placement: "center",
    title: "Export & Compare",
    body: "Use the export buttons (CSV, PDF, Word) in the results header to download reports. Select 2–3 candidates via the compare checkboxes on their cards to open a side-by-side comparison modal.",
    icon: (
      <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
  {
    id: "done",
    targetId: null,
    placement: "center",
    title: "You're Ready",
    subtitle: "Start ranking candidates",
    body: "That covers the essentials. Load the Hackathon Demo to explore right away, or paste your own JD and upload a dataset to begin. Reopen this guide anytime via the 'Guide' button in the header.",
    icon: (
      <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
  },
];

// ─── Spotlight overlay ────────────────────────────────────────────────────────
// pointer-events-auto blocks all background interaction while the guide is open.
// The tooltip card sits at a higher z-index with its own pointer-events.
const SpotlightOverlay = ({ targetRect }) => {
  if (!targetRect) {
    // Full dark veil for center-placement steps
    return <div className="fixed inset-0 bg-black/70 backdrop-blur-[1px] z-[9998] pointer-events-auto cursor-default" />;
  }

  const pad = 8;
  const T = targetRect.top - pad;
  const L = targetRect.left - pad;
  const W = targetRect.width + pad * 2;
  const H = targetRect.height + pad * 2;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-auto cursor-default">
      {/* Dimming veil with cutout — blocks everything except the spotlight area */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,0.75)",
          clipPath: `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${L}px ${T}px,${L}px ${T + H}px,${L + W}px ${T + H}px,${L + W}px ${T}px,${L}px ${T}px)`,
        }}
      />
      {/* Emerald highlight ring — visual only */}
      <div
        className="absolute pointer-events-none transition-all duration-300"
        style={{
          top: T, left: L, width: W, height: H,
          border: "1px solid rgba(16,185,129,0.6)",
          boxShadow: "0 0 0 2px rgba(16,185,129,0.10), 0 0 24px rgba(16,185,129,0.18)",
        }}
      />
    </div>
  );
};

// ─── Step dots ────────────────────────────────────────────────────────────────
const StepDots = ({ total, current, onGoTo }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }).map((_, i) => (
      <button
        key={i}
        type="button"
        onClick={() => onGoTo(i)}
        aria-label={`Go to step ${i + 1}`}
        style={{ pointerEvents: "auto" }}
        className={`rounded-full transition-all duration-200 ${
          i === current
            ? "w-4 h-1.5 bg-emerald-400"
            : i < current
            ? "w-1.5 h-1.5 bg-emerald-700"
            : "w-1.5 h-1.5 bg-slate-700 hover:bg-slate-600"
        }`}
      />
    ))}
  </div>
);

// ─── Tooltip card ─────────────────────────────────────────────────────────────
const TooltipCard = ({ step, stepIndex, totalSteps, targetRect, isFirst, isLast, onNext, onPrev, onSkip, onFinish, onGoTo }) => {
  const isCenter = step.placement === "center" || !targetRect;
  let style = {};
  let arrowPos = null;

  if (!isCenter && targetRect) {
    const TW = 460, TH = 290, ARROW = 10;
    const VW = window.innerWidth, VH = window.innerHeight;
    const mX = targetRect.left + targetRect.width / 2;
    const mY = targetRect.top + targetRect.height / 2;
    const opts = {
      bottom: { top: targetRect.bottom + ARROW + 12, left: Math.min(Math.max(mX - TW / 2, 12), VW - TW - 12) },
      top:    { top: targetRect.top - TH - ARROW - 12, left: Math.min(Math.max(mX - TW / 2, 12), VW - TW - 12) },
      right:  { top: Math.min(Math.max(mY - TH / 2, 12), VH - TH - 12), left: targetRect.right + ARROW + 12 },
      left:   { top: Math.min(Math.max(mY - TH / 2, 12), VH - TH - 12), left: targetRect.left - TW - ARROW - 12 },
    };
    const p = opts[step.placement] || opts.bottom;
    style = { position: "fixed", top: p.top, left: p.left, width: TW, zIndex: 9999, pointerEvents: "auto" };
    arrowPos = step.placement;
  } else {
    style = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 480, zIndex: 9999, pointerEvents: "auto" };
  }

  return (
    <div
      style={style}
      className="bg-slate-950 border border-slate-700/80 shadow-2xl shadow-black/60 font-mono animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${stepIndex + 1}: ${step.title}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Arrow pointer */}
      {arrowPos === "bottom" && <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-b-slate-700" />}
      {arrowPos === "top"    && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-slate-700" />}
      {arrowPos === "right"  && <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-r-[8px] border-t-transparent border-b-transparent border-r-slate-700" />}
      {arrowPos === "left"   && <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-b-[8px] border-l-[8px] border-t-transparent border-b-transparent border-l-slate-700" />}

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-800/60 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">{step.icon}</div>
          <div>
            {step.subtitle && (
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-0.5">{step.subtitle}</p>
            )}
            <h3 className="text-base font-bold text-slate-100 leading-snug">{step.title}</h3>
          </div>
        </div>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip guide tour"
          style={{ pointerEvents: "auto" }}
          className="shrink-0 text-slate-600 hover:text-slate-300 transition-colors text-xl leading-none mt-0.5"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-sm text-slate-400 leading-relaxed">{step.body}</p>
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 flex items-center justify-between gap-2">
        <StepDots total={totalSteps} current={stepIndex} onGoTo={onGoTo} />

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[11px] text-slate-600 font-mono tabular-nums">{stepIndex + 1}/{totalSteps}</span>

          {!isFirst && (
            <button
              type="button"
              onClick={onPrev}
              style={{ pointerEvents: "auto" }}
              className="px-3 py-1.5 text-xs uppercase tracking-wider font-bold bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all duration-150 flex items-center gap-1"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Prev
            </button>
          )}

          {!isLast ? (
            <button
              type="button"
              onClick={onNext}
              style={{ pointerEvents: "auto" }}
              className="px-4 py-1.5 text-xs uppercase tracking-wider font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/60 transition-all duration-150 flex items-center gap-1"
            >
              Next
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              style={{ pointerEvents: "auto" }}
              className="px-4 py-1.5 text-xs uppercase tracking-wider font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all duration-150 flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Finish
            </button>
          )}
        </div>
      </div>

      {/* Skip link */}
      {!isLast && (
        <div className="px-5 pb-4 -mt-2 text-center">
          <button
            type="button"
            onClick={onSkip}
            style={{ pointerEvents: "auto" }}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-wider"
          >
            Skip guide
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main GuideTour ───────────────────────────────────────────────────────────
const GuideTour = ({ onRestart }) => {
  const [active, setActive]       = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  // Show once per session
  useEffect(() => {
    if (!sessionStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setActive(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  // External restart
  useEffect(() => {
    if (onRestart) { setStepIndex(0); setActive(true); }
  }, [onRestart]);

  // Resolve spotlight target
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    const resolve = () => {
      if (!step.targetId) { setTargetRect(null); return; }
      const el = document.getElementById(step.targetId);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    resolve();
    window.addEventListener("resize", resolve);
    window.addEventListener("scroll", resolve, true);
    return () => {
      window.removeEventListener("resize", resolve);
      window.removeEventListener("scroll", resolve, true);
    };
  }, [active, stepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (stepIndex < TOUR_STEPS.length - 1) setStepIndex((p) => p + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (stepIndex > 0) setStepIndex((p) => p - 1);
      } else if (e.key === "Escape") {
        sessionStorage.setItem(TOUR_KEY, "true");
        setActive(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, stepIndex]);

  const handleNext   = useCallback(() => setStepIndex((p) => Math.min(p + 1, TOUR_STEPS.length - 1)), []);
  const handlePrev   = useCallback(() => setStepIndex((p) => Math.max(p - 1, 0)), []);
  const handleGoTo   = useCallback((i) => setStepIndex(i), []);
  const handleSkip   = useCallback(() => { sessionStorage.setItem(TOUR_KEY, "true"); setActive(false); }, []);
  const handleFinish = useCallback(() => { sessionStorage.setItem(TOUR_KEY, "true"); setActive(false); }, []);

  if (!active) return null;

  const step = TOUR_STEPS[stepIndex];

  return (
    <>
      <SpotlightOverlay targetRect={targetRect} />
      <TooltipCard
        step={step}
        stepIndex={stepIndex}
        totalSteps={TOUR_STEPS.length}
        targetRect={targetRect}
        isFirst={stepIndex === 0}
        isLast={stepIndex === TOUR_STEPS.length - 1}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
        onFinish={handleFinish}
        onGoTo={handleGoTo}
      />
    </>
  );
};

export default GuideTour;
