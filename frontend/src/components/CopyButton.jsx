import { useCopyToClipboard } from "../utils/copyUtils";

/**
 * CopyButton
 * A small icon-button that copies rich HTML + plain-text to clipboard.
 * Shows a check mark for 2 s after a successful copy.
 *
 * Props:
 *  plain     : string  — plain-text representation
 *  html      : string  — rich HTML representation (optional)
 *  label     : string  — aria-label / tooltip text
 *  size      : "sm" | "md" (default "sm")
 *  className : extra wrapper classes
 */
const CopyButton = ({ plain, html = null, label = "Copy", size = "sm", className = "" }) => {
  const { copy, copied } = useCopyToClipboard();

  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const btnSize = size === "md" ? "h-6 w-6" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); copy(plain, html); }}
      title={copied ? "Copied!" : label}
      aria-label={copied ? "Copied!" : label}
      className={`
        relative inline-flex items-center justify-center
        ${btnSize} shrink-0
        border rounded-none
        transition-all duration-200
        focus:outline-none focus:ring-1 focus:ring-emerald/40
        ${copied
          ? "border-emerald/60 bg-emerald/10 text-emerald shadow-[0_0_8px_rgba(16,185,129,0.35)]"
          : "border-slate-700/80 bg-slate-900/60 text-slate-500 hover:text-slate-300 hover:border-slate-600 hover:bg-slate-800/60"
        }
        ${className}
      `}
    >
      {copied ? (
        /* Check icon */
        <svg className={iconSize} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.5 6.5L4.5 9.5L10.5 3" />
        </svg>
      ) : (
        /* Copy icon */
        <svg className={iconSize} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="1" width="7" height="8" rx="0.5" />
          <path d="M1 4h2v6h5v2H1V4z" />
        </svg>
      )}
    </button>
  );
};

export default CopyButton;
