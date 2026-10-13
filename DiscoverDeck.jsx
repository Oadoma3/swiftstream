// DiscoverDeck.jsx - Zero-lag O(1) swipe queue, instant catalog quick-search, genre filter pills, and mobile haptics.
import { useState, useEffect, useCallback, useMemo, useRef, useContext, useDeferredValue, useId } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ACTIONS, ALL_SHOWS, PROVIDERS } from "./data";
import { BookmarkIcon, CheckIcon, LinkIcon, ProviderIcon, Toast, ToastCtx, UndoIcon, UsersIcon, XIcon } from "./ui";
import { PosterFace, SwipeCard, launchStream } from "./Card";
import { RATINGS, RATING_CHOICES, shuffle } from "./utils";

const haptic = (ms = 12) => {
  try { if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
};



function ActionButton({ action, onClick, size = 68, children }) {
  const a = ACTIONS[action];
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        onClick={onClick}
        aria-label={a.label}
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.86 }}
        transition={{ type: "spring", stiffness: 500, damping: 18 }}
        className="rounded-full flex items-center justify-center"
        style={{
          width: size, height: size,
          color: a.color,
          background: "var(--surface)",
          border: `2px solid ${a.color}`,
          boxShadow: `0 10px 28px -10px ${a.color}`,
        }}
      >
        {children}
      </motion.button>
      <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{a.label}</span>
    </div>
  );
}

function Count({ value, color, label }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <div className="relative h-9 overflow-visible">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            className="display block text-3xl leading-9"
            style={{ color, fontWeight: 800 }}
            initial={{ y: 16, scale: 1.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{label}</span>
    </div>
  );
}

function Finish({ log, shows, provider, onRestart, onHome }) {
  const saved = log.filter(l => l.action === "save").map(l => l.show);
  const seen = log.filter(l => l.action === "seen").length;
  const pct = shows.length ? Math.round((seen / shows.length) * 100) : 0;
  return (
    <motion.div
      className="w-full max-w-sm mx-auto text-center px-6"
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      <p className="text-sm" style={{ color: "var(--muted)" }}>{provider.name} sorted</p>
      <div className="display text-7xl mt-2" style={{ fontWeight: 800, color: "var(--seen)" }}>{pct}%</div>
      <p className="mt-1 text-base">You've seen {seen} of {shows.length}.</p>

      <div className="mt-5 text-left rounded-2xl p-4 max-h-48 overflow-y-auto no-scroll" style={{ background: "var(--surface)" }}>
        <p className="text-sm font-bold" style={{ color: "var(--save)" }}>Saved this session ({saved.length})</p>
        {saved.length === 0 ? (
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>Nothing bookmarked yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {saved.map(s => (
              <li key={`${s.providerId || ""}-${s.id}`} className="flex items-center gap-3 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.colors[0] }} />
                <span className="font-medium truncate">{s.title}</span>
                <span className="shrink-0" style={{ color: "var(--muted)" }}>{s.year}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <motion.button
          onClick={onRestart}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="px-7 py-3 rounded-full display text-base"
          style={{ background: "var(--text)", color: "var(--bg)", fontWeight: 800 }}
        >
          Reset Deck
        </motion.button>
        <motion.button
          onClick={onHome}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          className="px-6 py-3 rounded-full text-base font-bold"
          style={{ background: "var(--surface-2)", color: "var(--text)" }}
        >
          All Apps
        </motion.button>
      </div>
    </motion.div>
  );
}

/* Instant Universal Quick-Search across all 18 platforms */
function QuickCatalogSearch({ logs, onLog }) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const deferredQ = useDeferredValue(q);
  const wrapRef = useRef(null);
  const showToast = useContext(ToastCtx);

  useEffect(() => {
    if (!focused) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [focused]);

  // Rank exact & prefix matches first, then substring matches, without blocking the main thread
  const results = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    if (term.length < 2) return [];
    const prefix = [];
    const sub = [];
    for (let i = 0; i < ALL_SHOWS.length; i++) {
      const s = ALL_SHOWS[i];
      const t = (s.title || "").toLowerCase();
      if (t.startsWith(term)) {
        prefix.push(s);
        if (prefix.length >= 8) break;
      } else if (sub.length < 8 && t.includes(term)) {
        sub.push(s);
      }
    }
    return [...prefix, ...sub].slice(0, 8);
  }, [deferredQ]);

  const getStatus = (show) => {
    const list = logs[show.providerId] || [];
    const entry = list.find(e => e.show.id === show.id);
    return entry ? entry.action : null;
  };

  const quickMark = (show, action) => {
    haptic(14);
    onLog(show.providerId, (cur) => {
      const filtered = cur.filter(e => e.show.id !== show.id);
      return [...filtered, { show, action, rating: action === "seen" ? "seen" : undefined, t: Date.now() }];
    });
    showToast(action === "seen" ? `Marked "${show.title}" as Seen` : `Saved "${show.title}" to Watchlist`, show.network);
  };

  return (
    <div ref={wrapRef} className="mb-4 relative z-30">
      <div
        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
        style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ color: "var(--muted)" }} aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={q}
          onFocus={() => setFocused(true)}
          onChange={(e) => { setQ(e.target.value); setFocused(true); }}
          onKeyDown={(e) => { if (e.key === "Escape") { setFocused(false); e.currentTarget.blur(); } }}
          placeholder={`Search ${ALL_SHOWS.length.toLocaleString()} shows across all apps...`}
          aria-label="Quick search all shows"
          className="flex-1 min-w-0 bg-transparent outline-none text-base sm:text-sm"
          style={{ color: "var(--text)" }}
        />
        {q && (
          <button
            type="button"
            onClick={() => { setQ(""); setFocused(false); }}
            className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: "rgba(255,255,255,.1)", color: "var(--muted)" }}
          >
            {"\u2715"}
          </button>
        )}
      </div>

      <AnimatePresence>
        {focused && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 top-full mt-2 rounded-2xl p-2 space-y-1.5 max-h-72 overflow-y-auto no-scroll"
            style={{
              background: "rgba(20,16,38,.98)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 22px 48px -8px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.16)",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
            }}
          >
            {results.map(s => {
              const st = getStatus(s);
              return (
                <li
                  key={`${s.providerId}:${s.id}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-white/5"
                >
                  <button
                    type="button"
                    onClick={() => launchStream(s, s.network, showToast)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <ProviderIcon id={s.providerId} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{s.title}</p>
                      <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                        {s.network} • {s.year} {s.communityScore ? `• \uD83C\uDF45 ${s.communityScore}%` : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => quickMark(s, "save")}
                      className="px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                      style={{
                        background: st === "save" ? "var(--save)" : "rgba(255,200,87,.14)",
                        color: st === "save" ? "var(--bg)" : "var(--save)",
                      }}
                    >
                      {st === "save" ? "\u2605 Saved" : "+ Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => quickMark(s, "seen")}
                      className="px-2.5 py-1 rounded-full text-[11px] font-extrabold"
                      style={{
                        background: st === "seen" ? "var(--seen)" : "rgba(92,225,196,.14)",
                        color: st === "seen" ? "var(--bg)" : "var(--seen)",
                      }}
                    >
                      {st === "seen" ? "\u2713 Seen" : "\u2713 Seen"}
                    </button>
                  </div>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function ShuffleAllButton({ onClick, active, sorted }) {
  const total = ALL_SHOWS.length;
  return (
    <motion.button
      onClick={onClick}
      aria-label="Shuffle All (Mixed Mode)"
      aria-current={active ? "true" : undefined}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="relative overflow-hidden w-full text-left rounded-3xl px-5 py-5 mb-5"
      style={{
        background: "linear-gradient(120deg, #e0359f 0%, #7a3df0 52%, #1b8fe0 100%)",
        boxShadow: active ? "0 0 0 3px #fff, 0 18px 40px -12px rgba(122,61,240,.8)" : "0 18px 40px -14px rgba(122,61,240,.75)",
      }}
    >
      <span className="absolute -right-8 -top-10 w-40 h-40 rounded-full pointer-events-none" style={{ background: "rgba(255,255,255,.14)" }} aria-hidden="true" />
      <span className="relative block display text-2xl lg:text-xl leading-tight text-white" style={{ fontWeight: 800, textShadow: "0 2px 10px rgba(0,0,0,.35)" }}>
        {"\uD83D\uDD00"} Shuffle All (Mixed Mode)
      </span>
      <span className="relative block text-xs sm:text-sm mt-1" style={{ color: "rgba(255,255,255,.9)" }}>
        {sorted > 0 ? `${sorted.toLocaleString()} of ${total.toLocaleString()} sorted • Tap to shuffle fresh picks` : `All ${total.toLocaleString()} shows across every app, in random order.`}
      </span>
    </motion.button>
  );
}

function ProviderList({ onPick, activeId, counts = {}, logs = {}, onLog, sidebar = false }) {
  return (
    <div>
      {onLog && <QuickCatalogSearch logs={logs} onLog={onLog} onPick={onPick} />}
      <ShuffleAllButton onClick={() => onPick("mixed")} active={activeId === "mixed"} sorted={counts.mixed || 0} />
      <ProviderGrid onPick={onPick} activeId={activeId} counts={counts} sidebar={sidebar} />
    </div>
  );
}

export function ProviderSidebar({ onPick, activeId, counts }) {
  return (
    <div className="px-5 pb-6 pt-3">
      <ProviderList
        onPick={onPick}
        activeId={activeId}
        counts={counts}
        sidebar
      />
    </div>
  );
}

function ProviderGrid({ onPick, activeId, counts = {}, sidebar = false }) {
  return (
    <motion.div
      className={`grid ${sidebar ? "grid-cols-2 gap-x-4 gap-y-5" : "grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-5"}`}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } } }}
    >
      {PROVIDERS.map((p) => {
        const n = counts[p.id] || 0;
        const on = activeId === p.id;
        const done = n >= p.shows.length && p.shows.length > 0;
        return (
          <motion.button
            key={p.id}
            onClick={() => onPick(p.id)}
            aria-current={on ? "true" : undefined}
            aria-label={`${p.name}, ${n > 0 ? `${n} of${p.shows.length} sorted` : `${p.shows.length} shows`}`}
            variants={{ hidden: { opacity: 0, scale: 0.88, y: 10 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 24 } } }}
            whileHover={{ scale: 1.06, y: -3 }}
            whileTap={{ scale: 0.94 }}
            className={`flex flex-col items-center gap-2 rounded-3xl ${sidebar ? "p-3" : "p-2"}`}
          >
            <span className={`relative block w-full mx-auto ${sidebar ? "max-w-[112px]" : "max-w-[82px]"}`}>
              {on && (
                <span
                  className="absolute -inset-1.5 pointer-events-none"
                  style={{ borderRadius: "28%", boxShadow: `0 0 0 3px ${p.accent}, 0 0 24px -4px ${p.accent}` }}
                />
              )}
              <ProviderIcon id={p.id} size="100%" shadow />
              {done && (
                <span
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                  style={{ background: "var(--seen)", color: "var(--bg)", boxShadow: "0 0 0 2px var(--bg)" }}
                  aria-hidden="true"
                >
                  {"\u2713"}
                </span>
              )}
            </span>
            <span className={`${sidebar ? "text-sm" : "text-xs sm:text-sm"} font-bold text-center leading-tight truncate w-full`}>{p.name}</span>
            <span className={`${sidebar ? "text-xs" : "text-[10.5px]"} -mt-1 text-center`} style={{ color: n > 0 ? "var(--seen)" : "var(--muted)" }}>
              {n > 0 ? `${n.toLocaleString()} / ${p.shows.length.toLocaleString()}` : `${p.shows.length.toLocaleString()} shows`}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function HeroMesh() {
  const blobs = [
    { left: "6%",  top: "4%",  size: 560, color: "rgba(143,91,255,.34)", dx: 50,  dy: 30,  dur: 20 },
    { left: "52%", top: "42%", size: 520, color: "rgba(224,53,159,.26)", dx: -40, dy: -30, dur: 24 },
    { left: "26%", top: "56%", size: 480, color: "rgba(27,143,224,.26)", dx: 30,  dy: -40, dur: 22 },
  ];
  return (
    <div className="hidden lg:block absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.left, top: b.top, width: b.size, height: b.size,
            background: `radial-gradient(circle, ${b.color}, transparent 68%)`,
            filter: "blur(30px)",
          }}
          animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0] }}
          transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0" style={{ background: "radial-gradient(75% 60% at 50% 48%, transparent 35%, var(--bg) 100%)" }} />
    </div>
  );
}

const heroContainer = { hidden: {}, show: { transition: { staggerChildren: 0.13, delayChildren: 0.15 } } };
const heroItem = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

function CentralBrandHero({ compact = false }) {
  const gradientId = useId();
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "gap-2" : "gap-4"}`}>
      <div className={`relative ${compact ? "w-52 h-32" : "w-80 h-48 md:w-[26rem] md:h-60"}`}>
        <div
          className="absolute inset-x-12 inset-y-6 rounded-full blur-3xl"
          style={{ background: "linear-gradient(90deg, rgba(248,60,112,.35), rgba(124,58,237,.42), rgba(34,211,238,.38))" }}
          aria-hidden="true"
        />
        <svg className="relative h-full w-full overflow-visible" viewBox="0 0 360 210" fill="none" role="img" aria-label="Three streaming cards with a flame and play symbol">
          <defs>
            <linearGradient id={`${gradientId}-red`} x1="50" y1="40" x2="150" y2="190" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FB7185" />
              <stop offset="1" stopColor="#BE123C" />
            </linearGradient>
            <linearGradient id={`${gradientId}-purple`} x1="120" y1="20" x2="235" y2="190" gradientUnits="userSpaceOnUse">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#4C1D95" />
            </linearGradient>
            <linearGradient id={`${gradientId}-cyan`} x1="205" y1="42" x2="310" y2="190" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22D3EE" />
              <stop offset="1" stopColor="#0E7490" />
            </linearGradient>
            <linearGradient id={`${gradientId}-flame`} x1="143" y1="44" x2="208" y2="115" gradientUnits="userSpaceOnUse">
              <stop stopColor="#67E8F9" />
              <stop offset=".55" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
          <g opacity=".7" strokeLinecap="round" aria-hidden="true">
            <motion.path
              d="M14 103c35-21 55-20 82-13"
              stroke="#FB7185"
              strokeWidth="2"
              initial={{ pathLength: 0.65, opacity: 0.35 }}
              animate={{ pathLength: [0.65, 1, 0.65], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.path
              d="M10 116c33-13 54-13 76-8"
              stroke="#A78BFA"
              strokeWidth="2.5"
              initial={{ pathLength: 0.6, opacity: 0.4 }}
              animate={{ pathLength: [0.6, 1, 0.6], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.35 }}
            />
            <motion.path
              d="M278 89c26-10 47-8 69 2"
              stroke="#67E8F9"
              strokeWidth="2.5"
              initial={{ pathLength: 0.6, opacity: 0.4 }}
              animate={{ pathLength: [0.6, 1, 0.6], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
            />
            <motion.path
              d="M282 103c27-4 45 1 65 12"
              stroke="#22D3EE"
              strokeWidth="2"
              initial={{ pathLength: 0.65, opacity: 0.35 }}
              animate={{ pathLength: [0.65, 1, 0.65], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </g>
          <path
            d="M90 54h89a16 16 0 0 1 16 16v111a16 16 0 0 1-16 16h-89a16 16 0 0 1-16-16V70a16 16 0 0 1 16-16Z"
            transform="rotate(-13 132 125)"
            fill={`url(#${gradientId}-red)`}
            stroke="rgba(255,255,255,.38)"
            strokeWidth="2"
          />
          <path
            d="M181 54h89a16 16 0 0 1 16 16v111a16 16 0 0 1-16 16h-89a16 16 0 0 1-16-16V70a16 16 0 0 1 16-16Z"
            transform="rotate(13 222 125)"
            fill={`url(#${gradientId}-cyan)`}
            stroke="rgba(255,255,255,.4)"
            strokeWidth="2"
          />
          <path
            d="M135 29h90a17 17 0 0 1 17 17v119a17 17 0 0 1-17 17h-90a17 17 0 0 1-17-17V46a17 17 0 0 1 17-17Z"
            fill={`url(#${gradientId}-purple)`}
            stroke="rgba(255,255,255,.55)"
            strokeWidth="2.5"
            style={{ filter: "drop-shadow(0 14px 22px rgba(0,0,0,.45))" }}
          />
          <path
            d="M180 49c4 15-4 19-10 28-5 6-7 11-5 17 2-6 6-9 11-12 0 9 9 13 10 21 1 6-3 11-9 12-10 2-19-6-19-17 0-9 6-16 11-23 10-11 14-17 11-26Z"
            fill={`url(#${gradientId}-flame)`}
            style={{ filter: "drop-shadow(0 0 9px rgba(34,211,238,.65))" }}
          />
          <circle cx="180" cy="135" r="20" fill="rgba(8,6,16,.45)" stroke="rgba(255,255,255,.72)" strokeWidth="1.5" />
          <path d="M176 125.5v19l15-9.5-15-9.5Z" fill="white" />
        </svg>
      </div>
      <h1
        className={`${compact ? "text-4xl" : "text-5xl lg:text-6xl xl:text-8xl"} display font-black leading-none`}
        style={{
          backgroundImage: "linear-gradient(110deg, #67e8f9 0%, #a78bfa 50%, #e9d5ff 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          filter: "drop-shadow(0 0 24px rgba(124,58,237,.22))",
        }}
      >
        SwiftStream
      </h1>
      <div
        className={`${compact ? "w-32 h-1" : "w-48 h-1.5"} -mt-1 rounded-full`}
        style={{ background: "linear-gradient(90deg, #fb7185 0%, #a78bfa 50%, #22d3ee 100%)", boxShadow: "0 0 18px rgba(124,58,237,.45)" }}
        aria-hidden="true"
      />
      <p className={`${compact ? "text-sm" : "text-lg md:text-xl"} max-w-2xl`} style={{ color: "var(--muted)" }}>
        Pick a streaming app on the left, or hit Shuffle All to start swiping.
      </p>
    </div>
  );
}

function Home({ onPick, counts, logs, onLog }) {
  useEffect(() => {
    document.documentElement.style.setProperty("--glow", "rgba(124,58,237,.28)");
  }, []);
  const steps = [
    { c: "var(--seen)", t: "Seen it", d: "Give it a quick rating, or just mark it as seen." },
    { c: "var(--skip)", t: "Not seen", d: "Skip it and move to the next show." },
    { c: "var(--save)", t: "Save to watch", d: "Send it to your Watchlist." },
  ];
  return (
    <div className="relative min-h-full md:h-full overflow-visible md:overflow-hidden">
      <HeroMesh />

      <div className="md:hidden px-5 pt-3 pb-5 max-w-xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <CentralBrandHero compact />
        </motion.div>
        <div className="md:hidden mt-4">
          <ProviderList onPick={onPick} counts={counts} logs={logs} onLog={onLog} />
        </div>
      </div>

      <motion.div
        className="hidden md:flex relative z-10 min-h-[75vh] w-full flex-1 flex-col items-center justify-center p-8 text-center"
        variants={heroContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={heroItem}>
          <CentralBrandHero />
        </motion.div>

        <motion.div variants={heroItem} className="mt-7 w-full max-w-2xl">
          <QuickCatalogSearch logs={logs} onLog={onLog} />
        </motion.div>

        <ul className="mt-7 grid gap-5 xl:grid-cols-3 w-full max-w-3xl">
          {steps.map(s => (
            <motion.li key={s.t} variants={heroItem} className="flex flex-col items-center text-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full"
                style={{ background: s.c, boxShadow: `0 0 18px 2px ${s.c}` }}
                aria-hidden="true"
              />
              <span className="display text-lg" style={{ fontWeight: 800 }}>{s.t}</span>
              <span className="text-sm max-w-[16rem]" style={{ color: "var(--muted)" }}>{s.d}</span>
            </motion.li>
          ))}
        </ul>

        <motion.p variants={heroItem} className="mt-6 text-sm" style={{ color: "var(--muted)" }}>
          Tap any card to flip it for the synopsis, trailer, and streaming links.
        </motion.p>
      </motion.div>
    </div>
  );
}

/* ---------- Sorter: O(1) Locked Queue so swiping never re-filters or reshuffles mid-swipe ---------- */
function Sorter({ provider, log, onLog, onHome, locked = false, onGate, onSwipe }) {
  const [activeGenre, setActiveGenre] = useState(null);
  const [activeApps, setActiveApps] = useState([]);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    setActiveGenre(null);
    setActiveApps([]);
    setShuffleSeed(0);
  }, [provider.id]);

  const baseShows = useMemo(
    () => provider.shows.map(s => ({ ...s, network: s.network || provider.name })),
    [provider.id, provider.name, provider.shows]
  );

  const genres = useMemo(() => {
    const counts = {};
    baseShows.forEach(s => (s.genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([g]) => g);
  }, [baseShows]);

  const logRef = useRef(log);
  logRef.current = log;
  const isMixed = provider.id === "mixed";

  // Lock the deck order so swiping a card does NOT re-run filter/shuffle or change the preview card underneath!
  const shows = useMemo(() => {
    const currentLog = logRef.current;
    const swipedIds = new Set(currentLog.map(e => `${e.show.providerId || provider.id}:${e.show.id}`));
    const swipedList = currentLog.map(e => ({ ...e.show, network: e.show.network || provider.name }));
    let remaining = baseShows.filter(s => !swipedIds.has(`${s.providerId || provider.id}:${s.id}`));
    if (activeGenre) {
      remaining = remaining.filter(s => (s.genres || []).includes(activeGenre));
    }
    if (isMixed && activeApps.length > 0) {
      remaining = remaining.filter(s => activeApps.includes(s.providerId));
    }
    if (remaining.length > 0) {
      remaining = shuffle(remaining).slice(0, 300); // Shuffle and cap at 300 to keep memory light
    }
    return [...swipedList, ...remaining];
  }, [baseShows, provider.id, provider.name, activeGenre, activeApps, shuffleSeed, isMixed]);
  const setLog = useCallback((u) => onLog(provider.id, u), [onLog, provider.id]);
  const [dir, setDir] = useState("seen");
  const [flipped, setFlipped] = useState(false);
  const [pending, setPending] = useState(false);

  const index = log.length;
  const done = index >= shows.length;
  const current = shows[index];
  const next = shows[index + 1];

  // Preload next 4 posters
  useEffect(() => {
    const upcoming = shows.slice(index + 1, index + 5);
    upcoming.forEach(s => {
      if (s && s.posterUrl) {
        const img = new Image();
        img.src = s.posterUrl;
      }
    });
  }, [index, shows]);

  const seenCount = log.filter(l => l.action === "seen").length;
  const savedCount = log.filter(l => l.action === "save").length;
  const skipCount = log.filter(l => l.action === "skip").length;

  let streak = 0;
  for (let i = log.length - 1; i >= 0 && log[i].action === "seen"; i--) streak++;

  const currentRef = useRef(current);
  currentRef.current = current;

  const decide = useCallback((action, rating) => {
    const targetShow = currentRef.current;
    if (!targetShow) return;
    haptic(14);
    
    setDir(action);
    setFlipped(false);
    setLog(l => [...l, {
      show: targetShow,
      action,
      rating: action === "seen" ? (rating || "seen") : undefined,
      t: Date.now(),
    }]);
    if (onSwipe) onSwipe();
  }, [setLog, onSwipe]);

  const requestAction = useCallback((action) => {
    if (locked) { if (onGate) onGate(); return; }
    haptic(10);
    decide(action);
  }, [decide, locked, onGate]);

  const undo = useCallback(() => {
    haptic(10);
    
    setDir("undo");
    setFlipped(false);
    setLog(l => l.slice(0, -1));
  }, [pending, setLog]);

  const restart = () => {
    haptic(18);
    setDir("undo");
    setFlipped(false);
    
    setLog([]);
    setShuffleSeed(s => s + 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") requestAction("seen");
      else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") requestAction("skip");
      else if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") requestAction("save");
      else if (e.key.toLowerCase() === "f") setFlipped(f => !f);
      else if (e.key.toLowerCase() === "z" || e.key === "Backspace") undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, undo, requestAction]);

  useEffect(() => {
    const glow = current && current.colors ? current.colors[0] + "40" : "rgba(92,225,196,.2)";
    document.documentElement.style.setProperty("--glow", glow);
  }, [current]);

  return (
    <div className="h-full min-h-0 flex flex-col max-w-4xl mx-auto w-full select-none">

      {/* Mobile-First Compact Header */}
      <header className="px-4 pt-2 pb-1 md:px-5 md:pt-5 md:pb-2 md:w-full shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onHome}
              className="lg:hidden shrink-0 px-2.5 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "var(--surface)", color: "var(--text)" }}
            >
              ‹ Apps
            </button>
            <h1 className="display text-lg sm:text-2xl leading-tight flex items-center gap-2 min-w-0" style={{ fontWeight: 800 }}>
              <ProviderIcon id={provider.id} size={26} />
              <span className="truncate">{provider.name}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex md:hidden items-center gap-2 px-2.5 py-1 rounded-full text-xs font-extrabold" style={{ background: "var(--surface)" }}>
              <span style={{ color: "var(--seen)" }}>{"\u2713"} {seenCount}</span>
              <span style={{ color: "var(--save)" }}>{"\u2605"} {savedCount}</span>
              {streak >= 2 && <span style={{ color: "#ff8a3d" }}>{"\uD83D\uDD25"}{streak}</span>}
            </div>
            <button
              onClick={() => { haptic(12); setFlipped(false); setShuffleSeed(s => s + 1); }}
              title="Shuffle remaining shows"
              className="px-2.5 py-1.5 rounded-full text-xs font-bold active:scale-90 transition-transform"
              style={{ background: "var(--surface)", color: "var(--text)" }}
            >
              {"\uD83D\uDD00"}
            </button>
            <button
              onClick={undo}
              disabled={log.length === 0}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full transition-opacity"
              style={{ background: "var(--surface)", color: "var(--text)", opacity: log.length === 0 ? 0.35 : 1 }}
              aria-label="Undo last choice"
            >
              <UndoIcon /> <span className="hidden sm:inline">Undo</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 flex items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={shows.length} aria-valuenow={Math.min(index, shows.length)}>
          <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.14)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--seen)" }}
              initial={false}
              animate={{ width: `${shows.length ? Math.min(100, Math.round((index / shows.length) * 100)) : 0}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
          <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--muted)" }}>
            {Math.min(index + 1, shows.length).toLocaleString()} / {shows.length.toLocaleString()}
          </span>
        </div>

        {/* Thumb-scrollable Genre Filter Bar */}
        {genres.length > 1 && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scroll mt-2 pb-0.5 -mx-4 px-4 md:mx-0 md:px-0"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x" }}
          >
            <button
              onClick={() => { haptic(8); setFlipped(false); setActiveGenre(null); }}
              className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition"
              style={{
                background: activeGenre === null ? "var(--text)" : "var(--surface)",
                color: activeGenre === null ? "var(--bg)" : "var(--muted)",
              }}
            >
              All Genres
            </button>
            {genres.map(g => {
              const on = activeGenre === g;
              return (
                <button
                  key={g}
                  onClick={() => { haptic(8); setFlipped(false); setActiveGenre(on ? null : g); }}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition"
                  style={{
                    background: on ? "var(--text)" : "var(--surface)",
                    color: on ? "var(--bg)" : "var(--muted)",
                  }}
                >
                  {g}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Stage */}
      <main className="flex-1 min-h-0 w-full flex flex-col items-center justify-center px-4 gap-2.5 sm:gap-4">
        {done ? (
          <Finish log={log} shows={shows} provider={provider} onRestart={restart} onHome={onHome} />
        ) : (
          <>
            <div className="relative w-[min(86vw,340px)] h-[min(53dvh,470px)] md:w-auto md:h-[min(75vh,760px)] md:aspect-[2/3] max-w-full">
              {next && (
                <div className="absolute inset-0 pointer-events-none" style={{ transform: "scale(0.94) translateY(14px)", opacity: 0.55, filter: "brightness(.7)" }}>
                  <PosterFace show={next} prominent={isMixed} />
                </div>
              )}
              <AnimatePresence custom={dir} initial={false}>
                <SwipeCard
                  key={`${current.providerId || provider.id}-${current.id}`}
                  show={current}
                  dir={dir}
                  flipped={flipped}
                  onFlip={() => { haptic(8); setFlipped(f => !f); }}
                  onDecide={requestAction}
                  mixed={isMixed}
                />
              </AnimatePresence>
            </div>

            <div className="flex items-start justify-center w-full" style={{ minHeight: 86 }}>
              <div className="flex items-center justify-center gap-6 pb-2">
                <ActionButton action="skip" onClick={() => requestAction("skip")}><XIcon /></ActionButton>
                <ActionButton action="save" onClick={() => requestAction("save")} size={72}><BookmarkIcon /></ActionButton>
                <ActionButton action="seen" onClick={() => requestAction("seen")}><CheckIcon /></ActionButton>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Desktop-only Scoreboard Footer */}
      
    </div>
  );
}

function ActionPill({ icon, label, onClick, color }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94 }}
      className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-sm font-bold"
      style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
    >
      <span className="flex" style={{ color }}>{icon}</span>
      {label}
    </motion.button>
  );
}

function AccountMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex max-w-56 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold"
        style={{ background: "var(--seen)", color: "var(--bg)" }}
        title={user.email || user.name}
        aria-label={`Account: ${user.email || user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/10 font-extrabold">
          {(user.name || user.email || "U")[0].toUpperCase()}
        </span>
        <span className="truncate">{user.name || user.email}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-56 rounded-2xl p-2"
          style={{ background: "rgba(26,22,48,.98)", boxShadow: "0 18px 40px -10px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.14)" }}
        >
          <p className="px-2.5 py-1.5 text-xs truncate" style={{ color: "var(--muted)" }}>{user.email}</p>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onSignOut && onSignOut(); }}
            className="w-full text-left px-2.5 py-2 rounded-xl text-sm font-bold hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function ActionBar({ onMatch, onInvite, onOpenAuth, streak = 0, user = null, onSignOut }) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-3 pt-3 sm:px-5 md:px-10 md:pt-5">
      <StreakPill n={streak} />
      <ActionPill icon={<UsersIcon />} label="Watch Match" onClick={onMatch} color="var(--save)" />
      <ActionPill icon={<LinkIcon />} label="Invite" onClick={onInvite} color="var(--seen)" />
      {user ? (
        <AccountMenu user={user} onSignOut={onSignOut} />
      ) : (
        <motion.button
          type="button"
          onClick={onOpenAuth}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          className="z-30 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
        >
          <UsersIcon />
          <span>Sign In</span>
        </motion.button>
      )}
    </div>
  );
}

function StreakPill({ n }) {
  const pulse = useAnimationControls();
  const ring = useAnimationControls();
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) {
      pulse.start({ scale: [1, 1.22, 0.96, 1], transition: { duration: 0.55, ease: "easeOut" } });
      ring.start({ opacity: [0.9, 0], scale: [1, 1.7], transition: { duration: 0.7, ease: "easeOut" } });
    }
    prev.current = n;
  }, [n, pulse, ring]);

  return (
    <motion.div
      animate={pulse}
      className="relative mr-auto flex items-center gap-2 pl-3 pr-3.5 py-2 rounded-full text-sm font-bold"
      style={{ background: "var(--surface)", boxShadow: n > 0 ? "inset 0 0 0 1px rgba(255,138,61,.55)" : "inset 0 0 0 1px rgba(255,255,255,.1)" }}
      role="status"
      aria-label={`Swipe streak: ${n}`}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ opacity: 0, boxShadow: "0 0 0 2px rgba(255,138,61,.95), 0 0 18px 4px rgba(255,138,61,.55)" }}
        animate={ring}
      />
      <span aria-hidden="true">{"\uD83D\uDD25"}</span>
      <span className="relative inline-block" style={{ minWidth: "1ch" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={n}
            className="inline-block"
            style={{ color: n > 0 ? "#ff8a3d" : "var(--muted)" }}
            initial={{ y: 10, scale: 1.5, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {n}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="hidden min-[480px]:inline text-xs font-medium" style={{ color: "var(--muted)" }}>Swipe Streak</span>
    </motion.div>
  );
}

export default function DiscoverDeck({
  provider = null, pid = null, logs = {}, onLog, onPick, onHome, counts = {},
  locked, onGate, onSwipe, swipes, user, onSignOut, onOpenAuth, onOpenMatch, onOpenInvite,
}) {
  const activeProvider = provider && typeof provider === "object" && typeof provider.id === "string"
    ? provider
    : null;
  const safeLogs = logs && typeof logs === "object" && !Array.isArray(logs)
    ? Object.fromEntries(Object.entries(logs).map(([id, entries]) => [
      id,
      Array.isArray(entries)
        ? entries.filter(entry => entry && typeof entry === "object" && entry.show && typeof entry.show === "object")
        : [],
    ]))
    : {};
  const safeCounts = counts && typeof counts === "object" && !Array.isArray(counts) ? counts : {};
  const streak = Number.isFinite(swipes) ? swipes : 0;

  if (activeProvider && (!Array.isArray(activeProvider.shows) || activeProvider.shows.length === 0)) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <p className="display text-2xl font-extrabold">{activeProvider.name || "Provider"} has no shows available</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Choose another provider or return to the catalog.
          </p>
          <button
            type="button"
            onClick={onHome}
            className="mt-5 rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            All Apps
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
      
      <div className="h-full min-h-0 min-w-0 flex flex-col w-full max-w-4xl">
        <div>
          <ActionBar
            onMatch={onOpenMatch}
            onInvite={onOpenInvite}
            onOpenAuth={onOpenAuth}
            streak={streak}
            user={user}
            onSignOut={onSignOut}
          />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pid || "home"}
            className="w-full flex-1 min-h-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeProvider
              ? <Sorter provider={activeProvider} log={Array.isArray(safeLogs[activeProvider.id]) ? safeLogs[activeProvider.id] : []} onLog={onLog} onHome={onHome} locked={locked} onGate={onGate} onSwipe={onSwipe} />
              : <Home onPick={onPick} counts={safeCounts} logs={safeLogs} onLog={onLog} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}