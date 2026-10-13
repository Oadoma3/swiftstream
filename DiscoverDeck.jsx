// DiscoverDeck.jsx - Zero-lag O(1) swipe queue, instant catalog quick-search, genre filter pills, and mobile haptics.
import { useState, useEffect, useCallback, useMemo, useRef, useContext, useDeferredValue } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { ACTIONS, ALL_SHOWS, PROVIDERS, RATINGS, RATING_CHOICES } from "./data";
import { BookmarkIcon, CheckIcon, LinkIcon, ProviderIcon, ToastCtx, UndoIcon, UsersIcon, XIcon } from "./ui";
import { PosterFace, SwipeCard, launchStream } from "./Card";
import { shuffle } from "./utils";

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
            style={{ background: "rgba(20,16,38,.98)", backdropFilter: "blur(16px)", boxShadow: "0 22px 48px -8px rgba(0,0,0,.9), inset 0 0 0 1px rgba(255,255,255,.16)" }}
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

function ProviderList({ onPick, activeId, counts = {}, logs = {}, onLog }) {
  return (
    <div>
      {onLog && <QuickCatalogSearch logs={logs} onLog={onLog} onPick={onPick} />}
      <ShuffleAllButton onClick={() => onPick("mixed")} active={activeId === "mixed"} sorted={counts.mixed || 0} />
      <ProviderGrid onPick={onPick} activeId={activeId} counts={counts} />
    </div>
  );
}

function ProviderGrid({ onPick, activeId, counts = {} }) {
  return (
    <motion.div
      className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-3 gap-x-3 gap-y-5"
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
            className="flex flex-col items-center gap-1.5 rounded-3xl p-1"
          >
            <span className="relative block w-full max-w-[82px] mx-auto">
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
            <span className="text-xs sm:text-sm font-bold text-center leading-tight truncate w-full">{p.name}</span>
            <span className="text-[10.5px] -mt-1 text-center" style={{ color: n > 0 ? "var(--seen)" : "var(--muted)" }}>
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
    <div className="relative h-full overflow-hidden">
      <HeroMesh />

      <div className="lg:hidden h-full overflow-y-auto no-scroll px-5 pt-3 pb-24 max-w-xl md:max-w-2xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="display text-4xl leading-none" style={{ fontWeight: 800 }}>SwiftStream</h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>
            Pick a streaming app, quick-search, or shuffle all shows.
          </p>
        </motion.div>
        <div className="mt-4">
          <ProviderList onPick={onPick} counts={counts} logs={logs} onLog={onLog} />
        </div>
      </div>

      <motion.div
        className="hidden lg:flex relative z-10 h-full flex-col items-center justify-center px-10 pb-[60px] text-center"
        variants={heroContainer}
        initial="hidden"
        animate="show"
      >
        <motion.h1
          variants={heroItem}
          className="display text-6xl xl:text-7xl leading-none"
          style={{
            fontWeight: 800,
            backgroundImage: "linear-gradient(120deg, #ffffff 25%, #cdbdff 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          SwiftStream
        </motion.h1>
        <motion.p variants={heroItem} className="mt-4 text-lg max-w-md" style={{ color: "var(--muted)" }}>
          Pick a streaming app on the left, or hit Shuffle All, then swipe through its shows.
        </motion.p>

        <ul className="mt-10 grid gap-8 xl:grid-cols-3 w-full max-w-3xl">
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

        <motion.p variants={heroItem} className="mt-8 text-sm" style={{ color: "var(--muted)" }}>
          Tap any card to flip it for the synopsis, trailer, and streaming links.
        </motion.p>
      </motion.div>
    </div>
  );
}

/* ---------- Sorter: O(1) Locked Queue so swiping never re-filters or reshuffles mid-swipe ---------- */
function Sorter({ provider, log, onLog, onHome, locked = false, onGate, onSwipe }) {
  const [activeGenre, setActiveGenre] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    setActiveGenre(null);
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

  // Lock the deck order so swiping a card does NOT re-run filter/shuffle or change the preview card underneath!
  const shows = useMemo(() => {
    const currentLog = logRef.current;
    const swipedIds = new Set(currentLog.map(e => `${e.show.providerId || provider.id}:${e.show.id}`));
    const swipedList = currentLog.map(e => ({ ...e.show, network: e.show.network || provider.name }));
    let remaining = baseShows.filter(s => !swipedIds.has(`${s.providerId || provider.id}:${s.id}`));
    if (activeGenre) {
      remaining = remaining.filter(s => (s.genres || []).includes(activeGenre));
    }
    if (shuffleSeed > 0) {
      remaining = shuffle(remaining);
    }
    return [...swipedList, ...remaining];
  }, [baseShows, provider.id, provider.name, activeGenre, shuffleSeed]);

  const setLog = useCallback((u) => onLog(provider.id, u), [onLog, provider.id]);
  const isMixed = provider.id === "mixed";
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
    <div className="h-full flex flex-col max-w-xl md:max-w-none mx-auto w-full select-none">

      {/* Mobile-First Compact Header */}
      <header className="px-4 pt-2 pb-1 md:px-5 md:pt-5 md:pb-2 md:max-w-lg md:mx-auto md:w-full shrink-0">
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
          <div className="flex items-center gap-1.5 overflow-x-auto no-scroll mt-2 pb-0.5 -mx-4 px-4 md:mx-0 md:px-0">
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
      <main className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 gap-2.5 sm:gap-4">
        {done ? (
          <Finish log={log} shows={shows} provider={provider} onRestart={restart} onHome={onHome} />
        ) : (
          <>
            <div className="relative w-[min(86vw,340px)] h-[min(53dvh,470px)] md:w-auto md:h-[min(54vh,560px)] md:aspect-[2/3] max-w-full">
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
                <div className="mt-8"><ActionButton action="skip" onClick={() => requestAction("skip")}><XIcon /></ActionButton></div>
                <div className="mb-8"><ActionButton action="save" onClick={() => requestAction("save")} size={58}><BookmarkIcon /></ActionButton></div>
                <div className="mt-8"><ActionButton action="seen" onClick={() => requestAction("seen")}><CheckIcon /></ActionButton></div>
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
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold"
        style={{ background: "var(--seen)", color: "var(--bg)" }}
        title={user.email}
        aria-label={`Signed in as ${user.email}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {(user.name || user.email)[0].toUpperCase()}
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

function ActionBar({ onMatch, onInvite, streak = 0, user = null, onSignOut }) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-end gap-2 px-5 pt-3 md:px-10 md:pt-5">
      <StreakPill n={streak} />
      <ActionPill icon={<UsersIcon />} label="Watch Match" onClick={onMatch} color="var(--save)" />
      <ActionPill icon={<LinkIcon />} label="Invite" onClick={onInvite} color="var(--seen)" />
      {user && <AccountMenu user={user} onSignOut={onSignOut} />}
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
  provider, pid, logs, onLog, onPick, onHome, counts,
  locked, onGate, onSwipe, swipes, user, onSignOut, onOpenMatch, onOpenInvite,
}) {
  return (
    <div className="h-full">
      
      <div className="h-full min-w-0 flex flex-col">
        <div className={provider ? "hidden lg:block" : "block"}>
          <ActionBar onMatch={onOpenMatch} onInvite={onOpenInvite} streak={swipes} user={user} onSignOut={onSignOut} />
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pid || "home"}
            className="flex-1 min-h-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {provider
              ? <Sorter provider={provider} log={logs[provider.id] || []} onLog={onLog} onHome={onHome} locked={locked} onGate={onGate} onSwipe={onSwipe} />
              : <Home onPick={onPick} counts={counts} logs={logs} onLog={onLog} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}