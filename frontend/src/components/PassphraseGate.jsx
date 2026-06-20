import { useState, useRef, useEffect } from "react";
import { LockIcon } from "./icons";

// ─── Eye / Eye-Off toggle icons ───────────────────────────────────────────────
const EyeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-4 h-4"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ─── ShieldCheck icon ─────────────────────────────────────────────────────────
const ShieldCheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const PassphraseGate = ({ onAuthenticate }) => {
  const [phrase, setPhrase] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!phrase.trim()) {
      setIsShaking(true);
      setError("Passphrase cannot be empty");
      setTimeout(() => setIsShaking(false), 600);
      inputRef.current?.focus();
      return;
    }
    setPulse(true);
    setTimeout(() => {
      onAuthenticate(phrase.trim());
    }, 180);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-midnight relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(16,185,129,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-slate-800/80 bg-slate-950/90 backdrop-blur-xl p-8 flex flex-col gap-6 shadow-2xl transition-transform ${
          isShaking ? "animate-shake" : ""
        } ${pulse ? "scale-[1.02]" : ""}`}
        style={{
          boxShadow:
            "0 0 0 1px rgba(16,185,129,0.08), 0 25px 50px -12px rgba(0,0,0,0.8), 0 0 60px rgba(16,185,129,0.05)",
          transition: "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Animated lock ring */}
          <div
            className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background:
                "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 60%, transparent 100%)",
              boxShadow:
                "0 0 0 1px rgba(16,185,129,0.2), 0 0 20px rgba(16,185,129,0.1)",
            }}
          >
            <span className="text-emerald-400">
              <LockIcon />
            </span>
          </div>

          <div>
            <h1 className="text-white font-bold text-xl tracking-tight">
              RRR Recruiter
            </h1>
            <p className="text-slate-500 text-xs mt-0.5 font-mono uppercase tracking-widest">
              Resume Ranker · Recruiter
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald/10 border border-emerald/20 text-emerald animate-pulse">
              <LockIcon className="w-2.5 h-2.5 shrink-0" />
              <span>Encrypted Locally (AES-256)</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm text-center leading-relaxed">
          Enter your{" "}
          <span className="text-emerald-400 font-medium">private passphrase</span>{" "}
          to access your encrypted talent pools.
          <br />
          <span className="text-slate-500 text-xs">
            New here? Any passphrase creates a fresh private workspace.
          </span>
        </p>

        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-mono text-slate-500 uppercase tracking-wider" htmlFor="passphrase-input">
            Passphrase
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="passphrase-input"
              type={showPhrase ? "text" : "password"}
              value={phrase}
              aria-invalid={!!error}
              aria-describedby={error ? "passphrase-error" : undefined}
              onChange={(e) => {
                setPhrase(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter your private passphrase…"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-3 pr-11 text-white text-sm placeholder-slate-600 outline-none transition-all duration-200 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20"
            />
            {/* Toggle visibility */}
            <button
              type="button"
              onClick={() => setShowPhrase((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              title={showPhrase ? "Hide passphrase" : "Show passphrase"}
            >
              {showPhrase ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {error && (
            <p id="passphrase-error" role="alert" className="text-xs text-rose-500 font-mono mt-1">
              {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <button
          id="enter-workspace-btn"
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-lg px-4 py-3 font-bold text-sm text-midnight bg-emerald hover:bg-emerald/90 active:scale-[0.98] transition-all duration-150 shadow-lg"
          style={{
            boxShadow: "0 0 20px rgba(16,185,129,0.25)",
          }}
        >
          Enter Workspace
        </button>

        {/* Trust badge row */}
        <div className="flex items-center justify-center gap-4 pt-1">
          {[
            "AES-256 Encrypted",
            "No Server · Local Only",
            "Private per Passphrase",
          ].map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 text-[10px] text-slate-600 font-mono"
            >
              <span className="text-emerald-600">
                <ShieldCheckIcon />
              </span>
              {label}
            </span>
          ))}
        </div>

        {/* Warning note */}
        <div className="text-center text-[10px] text-slate-600 leading-snug flex items-start justify-center gap-1.5 px-4">
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-left font-mono">If you forget your passphrase, your pools cannot be recovered — by design.</span>
        </div>
      </div>

      {/* shake keyframe injected inline so we don't need a CSS file change */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        .animate-shake { animation: shake 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
      `}</style>
    </div>
  );
};

export default PassphraseGate;
