// ui.jsx - Shared UI primitives: icons, provider app-icon tiles, bottom sheet / modal shell, toast.
import { useEffect, useRef, createContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS } from "./data";

/* ---------- Icons ---------- */
export const CheckIcon = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>
);
export const XIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
);
export const BookmarkIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z"/></svg>
);
export const UndoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>
);

/* ---------- Provider app icon tiles (inline SVG squircles) ---------- */
const SQUIRCLE = "M0,50 C0,8 8,0 50,0 S100,8 100,50 S92,100 50,100 S0,92 0,50 Z";
const PEACOCK_DOTS = ["#ffd23f", "#ff8a3d", "#ff4d6d", "#b45cff", "#3d8bff", "#2bd88a"].map((c, i) => {
  const a = ((200 + i * 28) * Math.PI) / 180;
  return { c, x: 50 + 32 * Math.cos(a), y: 76 + 32 * Math.sin(a) };
});

export function ProviderIcon({ id, name, size = 48, shadow = false, className = "" }) {
  if (id === "mixed") {
    const d = typeof size === "number" ? { width: size, height: size } : { width: size, height: "auto" };
    return (
      <svg role="img" aria-label="Mixed Mode" viewBox="0 0 100 100" className={className}
        style={{ display: "block", flexShrink: 0, ...d, filter: shadow ? "drop-shadow(0 8px 14px rgba(0,0,0,.45))" : undefined }}>
        <defs>
          <linearGradient id="mixed-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e0359f" /><stop offset="0.55" stopColor="#7a3df0" /><stop offset="1" stopColor="#1b8fe0" />
          </linearGradient>
        </defs>
        <path d={SQUIRCLE} fill="url(#mixed-grad)" />
        <g fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 34h12c10 0 16 8 22 16s12 16 22 16h6" />
          <path d="M20 66h12c6 0 10-3 14-8" />
          <path d="M58 42c4-5 8-8 14-8h8" />
          <path d="M72 24l10 10-10 10" />
          <path d="M72 56l10 10-10 10" />
        </g>
      </svg>
    );
  }
  const prov = PROVIDERS.find(p => (id ? p.id === id : p.name === name));
  if (!prov) return null;
  const t = { fontFamily: '"Bricolage Grotesque","DM Sans",system-ui,sans-serif', fontWeight: 800, textAnchor: "middle" };
  const glyphs = {
    netflix: <text x="50" y="73" fontSize="68" fill="#fff" style={t}>N</text>,
    hulu: <text x="50" y="62" fontSize="38" fill="#0b0c0f" style={t}>hulu</text>,
    prime: (
      <>
        <text x="50" y="52" fontSize="30" fill="#fff" style={t}>prime</text>
        <path d="M27 63 Q50 80 73 63" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
    peacock: (
      <>
        {PEACOCK_DOTS.map(d => <circle key={d.c} cx={d.x} cy={d.y} r="8" fill={d.c} />)}
        <circle cx="50" cy="76" r="7" fill="#fff" />
      </>
    ),
    paramount: (
      <>
        <polygon points="16,76 40,38 56,62 66,48 84,76" fill="#fff" />
        <path d="M74 14v16M66 22h16" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      </>
    ),
    disney: (
      <>
        <path d="M20 38 Q50 14 80 38" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
        <text x="50" y="74" fontSize="42" fill="#fff" style={t}>D+</text>
      </>
    ),
    max: <text x="50" y="62" fontSize="38" fill="#fff" style={t}>max</text>,
    apple: <text x="50" y="62" fontSize="36" fill="#fff" style={t}>tv+</text>,
    tubi: <text x="50" y="60" fontSize="34" fill="#fff" style={t}>tubi</text>,
    crunchyroll: (
      <>
        <circle cx="50" cy="50" r="27" fill="none" stroke="#fff" strokeWidth="9" />
        <circle cx="58" cy="50" r="12" fill="#fff" />
      </>
    ),
  };
  const dim = typeof size === "number" ? { width: size, height: size } : { width: size, height: "auto" };
  return (
    <svg
      role="img"
      aria-label={prov.name}
      viewBox="0 0 100 100"
      className={className}
      style={{ display: "block", flexShrink: 0, ...dim, filter: shadow ? "drop-shadow(0 8px 14px rgba(0,0,0,.45))" : undefined }}
    >
      <path d={SQUIRCLE} fill={prov.brand} />
      {(prov.brand === "#000000" || prov.id === "peacock") && (
        <path d={SQUIRCLE} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
      )}
      {glyphs[prov.id]}
    </svg>
  );
}

export const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6"/><path d="M12 7.2v.1"/></svg>
);
export const FlipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>
);

/* Toast hook: BackFace calls this when "Watch Now" is pressed (provided by App). */
export const ToastCtx = createContext(() => {});

const svgProps = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
export const UsersIcon = () => (<svg {...svgProps}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 14.2c2.4.2 4 2 4 4.8"/></svg>);
export const LinkIcon = () => (<svg {...svgProps}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>);
export const ShareIcon = () => (<svg {...svgProps}><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>);
export const CopyIcon = () => (<svg {...svgProps}><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg>);
const CloseIcon = () => (<svg {...svgProps}><path d="M6 6l12 12M18 6L6 18"/></svg>);
export const LockIcon = () => (<svg {...svgProps} width="14" height="14"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>);

/* Bottom sheet on phones, centered modal on desktop */
export function Sheet({ title, subtitle, onClose, onKey, children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  const keyRef = useRef(onKey);
  closeRef.current = onClose;
  keyRef.current = onKey;

  useEffect(() => {
    if (panelRef.current) panelRef.current.focus();
    // Capture phase: keep game shortcuts (arrows, letters, digits) from reaching the page underneath.
    const handler = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); closeRef.current(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const swallow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Backspace"].includes(e.key) || /^[a-z0-9]$/i.test(e.key);
      if (swallow) {
        e.stopPropagation();
        if (keyRef.current) keyRef.current(e);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(6,4,14,.74)", backdropFilter: "blur(4px)" }} onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full md:max-w-lg overflow-y-auto no-scroll rounded-t-[28px] md:rounded-[28px] outline-none"
        style={{
          maxHeight: "min(94%, 880px)",
          background: "var(--bg)",
          boxShadow: "0 -20px 60px -10px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="display text-2xl leading-tight" style={{ fontWeight: 800 }}>{title}</h2>
            {subtitle && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "var(--surface)", color: "var(--muted)" }}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ---------- Toast ---------- */
export function Toast({ toast }) {
  return (
    <div
      className="fixed inset-x-0 z-[90] flex justify-center pointer-events-none px-4"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="flex items-center gap-3 rounded-full pl-2 pr-5 py-2"
            style={{
              background: "rgba(36,31,66,.96)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 12px 40px -8px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.14)",
            }}
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            {toast.name && <ProviderIcon name={toast.name} size={32} />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
