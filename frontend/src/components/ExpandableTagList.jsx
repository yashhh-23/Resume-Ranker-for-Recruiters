import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import CopyButton from "./CopyButton";
import { buildTagListCopy } from "../utils/copyUtils";

/**
 * ExpandableTagList
 *
 * Shows `limit` visible tags inline. When there are more hidden items,
 * a glowing "+X more" badge appears. Clicking it opens a glassmorphism
 * HUD panel rendered via React Portal (fixed to viewport) so it is
 * never clipped by parent overflow:hidden containers.
 *
 * Props:
 *  - items         : array to render
 *  - limit         : visible count before overflow (default: 5)
 *  - renderItem    : (item, index) => ReactNode — renders each tag
 *  - label         : string — shown as the panel header
 *  - accentColor   : CSS hex color for glow/border
 *  - className     : extra className on the outer flex wrapper
 */
const ExpandableTagList = ({
  items = [],
  limit = 5,
  renderItem,
  label = "Items",
  accentColor = "#10B981",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);
  const panelRef = useRef(null);

  // Recalculate position whenever panel opens or window resizes/scrolls
  const calcPos = useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const panelWidth = 288; // 72 * 4 = w-72
    const vw = window.innerWidth;

    // Prefer above the badge; fallback to below if not enough room
    let top = rect.top - 8; // will be shifted up by panel height via transform
    let left = rect.left;

    // Keep panel within right edge
    if (left + panelWidth > vw - 12) {
      left = Math.max(8, vw - panelWidth - 12);
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    calcPos();
    window.addEventListener("scroll", calcPos, true);
    window.addEventListener("resize", calcPos);
    return () => {
      window.removeEventListener("scroll", calcPos, true);
      window.removeEventListener("resize", calcPos);
    };
  }, [open, calcPos]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        badgeRef.current && !badgeRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!items || items.length === 0) return null;

  const visible = items.slice(0, limit);
  const hidden = items.slice(limit);
  const hiddenCount = hidden.length;

  const panel = open && createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`All ${label}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: 288,
        zIndex: 99999,
        // Shift upward so panel bottom aligns with badge top
        transform: "translateY(-100%)",
        filter: `drop-shadow(0 0 24px ${accentColor}33)`,
      }}
      className="animate-hud-in"
    >
      {/* Panel shell */}
      <div
        className="rounded-none border overflow-hidden"
        style={{
          background: "rgba(7,8,10,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderColor: `${accentColor}66`,
          boxShadow: `0 0 0 1px ${accentColor}22, 0 16px 48px rgba(0,0,0,0.8), inset 0 0 32px rgba(0,0,0,0.4)`,
        }}
      >
        {/* Accent top bar */}
        <div
          className="h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <span
              className="text-[9px] uppercase tracking-[0.2em] font-mono font-bold"
              style={{ color: accentColor }}
            >
              {label}
            </span>
            <span className="text-[9px] font-mono text-slate-600 ml-0.5">
              · {hiddenCount} hidden
            </span>
          </div>
          <div className="flex items-center gap-1">
            {/* Copy all hidden items */}
            <CopyButton
              plain={buildTagListCopy(`${label} (all ${items.length})`, items.map((item, i) => typeof item === "string" ? item : (item?.name ?? String(i)))).plain}
              html={buildTagListCopy(`${label} (all ${items.length})`, items.map((item, i) => typeof item === "string" ? item : (item?.name ?? String(i)))).html}
              label={`Copy all ${label}`}
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="h-5 w-5 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 transition-colors rounded-none focus:outline-none"
              aria-label="Close panel"
            >
              <svg viewBox="0 0 10 10" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 1l8 8M9 1l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tag grid — stagger-animated */}
        <div className="px-3 py-2.5 max-h-60 overflow-y-auto custom-scrollbar">
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((item, idx) => (
              <span
                key={idx}
                className="hud-tag-in"
                style={{ animationDelay: `${Math.min(idx * 25, 400)}ms` }}
              >
                {renderItem ? renderItem(item, idx + limit) : <span className="text-slate-300 text-[10px] font-mono">{item}</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Scan-line footer */}
        <div className="px-3 py-1.5 border-t border-white/[0.04] flex items-center justify-between">
          <span className="text-[9px] font-mono text-slate-700">
            {items.length} total · {visible.length} shown
          </span>
          <span className="text-[9px] font-mono text-slate-700">
            ESC to close
          </span>
        </div>

        {/* Corner accents */}
        <span className="absolute top-0 left-0 w-2 h-2 border-t border-l pointer-events-none" style={{ borderColor: accentColor }} />
        <span className="absolute top-0 right-0 w-2 h-2 border-t border-r pointer-events-none" style={{ borderColor: accentColor }} />
        <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l pointer-events-none" style={{ borderColor: accentColor }} />
        <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r pointer-events-none" style={{ borderColor: accentColor }} />
      </div>

      {/* Caret pointing down to the badge */}
      <div style={{ paddingLeft: 12 }}>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid ${accentColor}66`,
          }}
        />
      </div>
    </div>,
    document.body
  );

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {/* Visible tags */}
      {visible.map((item, idx) =>
        renderItem ? renderItem(item, idx) : <span key={idx}>{item}</span>
      )}

      {/* +X more badge */}
      {hiddenCount > 0 && (
        <div className="relative inline-flex">
          <button
            ref={badgeRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            aria-expanded={open}
            aria-label={`${open ? "Close" : "Show"} ${hiddenCount} more ${label}`}
            className="group relative inline-flex items-center gap-1.5 px-2.5 py-0.5 font-mono font-bold text-[10px] border rounded-none cursor-pointer select-none transition-all duration-200 focus:outline-none"
            style={{
              color: open ? accentColor : "#94a3b8",
              borderColor: open ? `${accentColor}88` : "#334155",
              backgroundColor: open ? `${accentColor}14` : "rgba(15,23,42,0.6)",
              boxShadow: open ? `0 0 12px ${accentColor}44, inset 0 0 8px ${accentColor}14` : undefined,
            }}
            onMouseEnter={(e) => {
              if (!open) {
                e.currentTarget.style.color = accentColor;
                e.currentTarget.style.borderColor = `${accentColor}88`;
                e.currentTarget.style.backgroundColor = `${accentColor}10`;
                e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}44`;
              }
            }}
            onMouseLeave={(e) => {
              if (!open) {
                e.currentTarget.style.color = "#94a3b8";
                e.currentTarget.style.borderColor = "#334155";
                e.currentTarget.style.backgroundColor = "rgba(15,23,42,0.6)";
                e.currentTarget.style.boxShadow = "";
              }
            }}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-200 ${open ? "animate-pulse" : "group-hover:animate-pulse"}`}
              style={{ backgroundColor: accentColor, opacity: open ? 1 : 0.5 }}
            />
            {open ? `– hide ${hiddenCount}` : `+${hiddenCount} more`}
          </button>

          {panel}
        </div>
      )}
    </div>
  );
};

export default ExpandableTagList;
