// Library.jsx - Watchlist & Library with "Pick Tonight's Show" roulette, Mark Seen / Remove actions, search, and filters.
import { useState, useEffect, useRef, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PROVIDERS, RATINGS, RATING_CHOICES } from "./data";
import { ProviderIcon, ToastCtx } from "./ui";
import { BackFace, FlipCard, PosterFace, launchStream, launchTrailer } from "./Card";

const COLLECTION_META = {
  watchlist: {
    title: "Watchlist",
    blurb: "Shows you saved to watch",
    color: "var(--save)",
    empty: "Nothing saved yet. Tap the bookmark on any show in Discover and it lands here.",
  },
  library: {
    title: "My Library",
    blurb: "Shows you've seen",
    color: "var(--seen)",
    empty: "No shows logged yet. Mark shows as seen in Discover to build your library.",
  },
};

function matchesProvider(item, prov) {
  if (!prov) return false;
  return item.providerId === prov.id || item.network === prov.name || (item.platforms || []).includes(prov.name);
}

function aggregateGenres(items) {
  const counts = {};
  items.forEach(i => (i.genres || []).forEach(g => { counts[g] = (counts[g] || 0) + 1; }));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

function StreamingDNA({ items }) {
  return (
    <section className="rounded-3xl p-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
      <h2 className="display text-xl" style={{ fontWeight: 800 }}>Streaming DNA</h2>
      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>How much of each app's catalog you've explored</p>
      <div className="mt-4 space-y-3.5">
        {PROVIDERS.map(p => {
          const total = Math.max(1, p.shows.length);
          const seen = items.filter(i => i.providerId === p.id).length;
          const pct = Math.min(100, Math.round((seen / total) * 100));
          return (
            <div key={p.id}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2.5">
                  <ProviderIcon id={p.id} size={26} />
                  <span>
                    <span className="font-bold">{p.name}</span>
                    <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>{seen} of {p.shows.length} seen</span>
                  </span>
                </span>
                <span style={{ color: "var(--muted)" }}>
                  <span className="font-bold" style={{ color: pct > 0 ? p.accent : "var(--muted)" }}>{pct}%</span> Explored
                </span>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: p.accent }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 22 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TopGenres({ items }) {
  const ranking = aggregateGenres(items).slice(0, 5);
  return (
    <section className="rounded-3xl p-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.07)" }}>
      <h2 className="display text-xl" style={{ fontWeight: 800 }}>Top Genres</h2>
      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Share of genre tags across the shows you've seen</p>
      {ranking.length === 0 ? (
        <p className="text-sm mt-3" style={{ color: "var(--muted)" }}>Mark a few shows as seen and your genre ranking shows up here.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {ranking.map((g, i) => (
            <li key={g.genre} className="flex items-center gap-3">
              <span className="display text-lg w-6 text-right" style={{ fontWeight: 800, color: i === 0 ? "var(--seen)" : "var(--muted)" }}>{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-bold truncate">{g.genre}</span>
                  <span style={{ color: "var(--muted)" }}>{g.pct}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: i === 0 ? "var(--seen)" : "rgba(255,255,255,.45)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${g.pct}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 22 }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MatchBadge() {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0 text-sm"
      title="Shared match"
      aria-label="Shared match"
      style={{ width: 32, height: 32, background: "var(--save)", boxShadow: "0 4px 12px -4px rgba(0,0,0,.6)" }}
    >
      {"\uD83D\uDC65"}
    </span>
  );
}

function RatingButton({ rating, open, onOpen }) {
  const r = RATINGS[rating] || RATINGS.seen;
  return (
    <motion.button
      data-rating-btn
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      onKeyDown={(e) => e.stopPropagation()}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={`Rating: ${r.label}. Change rating`}
      className="flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 40, height: 40, background: "rgba(8,6,16,.8)", border: `2px solid ${r.color}`, color: r.color,
        fontSize: 20, fontWeight: 800, lineHeight: 1,
        boxShadow: open ? `0 0 0 4px ${r.color}55` : undefined,
      }}
    >
      {r.emoji}
    </motion.button>
  );
}

function CollectionTile({ item, kind, onRate, onMoveToSeen, onRemove }) {
  const [flipped, setFlipped] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const liRef = useRef(null);
  const menuRef = useRef(null);
  const isLibrary = kind === "library";

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (liRef.current && liRef.current.contains(e.target) && e.target.closest("[data-rating-btn]")) return;
      setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const pick = (r) => { if (onRate) onRate(item.providerId, item.id, r); setMenuOpen(false); };
  const badge = isLibrary
    ? <RatingButton rating={item.rating} open={menuOpen} onOpen={() => setMenuOpen(o => !o)} />
    : item.shared ? <MatchBadge /> : null;
  const current = item.rating || "seen";

  return (
    <motion.li
      ref={liRef}
      variants={{ hidden: { opacity: 0, y: 14, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 320, damping: 26 } } }}
      className="relative"
      style={{ aspectRatio: "2 / 3", zIndex: menuOpen ? 30 : undefined }}
    >
      <FlipCard
        className="absolute inset-0 cursor-pointer"
        front={<PosterFace show={item} compact badge={badge} />}
        back={
          <BackFace
            show={item}
            compact
            onMarkSeen={!isLibrary && onMoveToSeen ? () => onMoveToSeen(item) : null}
            onRemove={onRemove ? () => onRemove(item) : null}
          />
        }
        flipped={flipped}
        onTap={() => { setMenuOpen(false); setFlipped(f => !f); }}
        label={`${item.title}${isLibrary ? `, rated ${(RATINGS[current] || RATINGS.seen).label}` : ""}. Activate to ${flipped ? "show the poster" : "see details"}.`}
      />

      <AnimatePresence>
        {isLibrary && menuOpen && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Change rating"
            className="absolute right-2 top-14 z-20 w-44 rounded-2xl p-1.5"
            style={{
              background: "rgba(26,22,48,.98)",
              boxShadow: "0 18px 40px -10px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.14)",
              transformOrigin: "top right",
            }}
            initial={{ opacity: 0, scale: 0.85, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ type: "spring", stiffness: 460, damping: 30 }}
          >
            {RATING_CHOICES.map(k => {
              const r = RATINGS[k];
              const on = current === k;
              return (
                <button
                  key={k}
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => pick(k)}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-sm font-bold text-left hover:bg-white/10"
                  style={{ background: on ? "rgba(255,255,255,.12)" : "transparent" }}
                >
                  <span className="text-lg leading-none" aria-hidden="true">{r.emoji}</span>
                  <span className="flex-1">{r.label}</span>
                  {on && <span style={{ color: r.color }} aria-hidden="true">{"\u2713"}</span>}
                </button>
              );
            })}
            <div className="my-1 h-px" style={{ background: "rgba(255,255,255,.1)" }} />
            <button
              role="menuitemradio"
              aria-checked={current === "seen"}
              onClick={() => pick("seen")}
              className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-sm font-bold text-left hover:bg-white/10"
              style={{ background: current === "seen" ? "rgba(255,255,255,.12)" : "transparent", color: "var(--muted)" }}
            >
              <span className="text-lg leading-none w-[1.1em] text-center" aria-hidden="true">{"\u2715"}</span>
              <span className="flex-1">Remove rating</span>
              {current === "seen" && <span style={{ color: RATINGS.seen.color }} aria-hidden="true">{"\u2713"}</span>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function Collection({ kind, items, onDiscover, onRate, onMoveToSeen, onRemove, onOpenMatch, guest = false, onAuth }) {
  const showToast = useContext(ToastCtx);
  const meta = COLLECTION_META[kind];
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [query, setQuery] = useState(""); const [sortBy, setSortBy] = useState("recent"); const [visibleCount, setVisibleCount] = useState(36);
  const [pickedShow, setPickedShow] = useState(null);
  const sharedView = kind === "watchlist" && view === "shared";

  useEffect(() => {
    document.documentElement.style.setProperty("--glow", "rgba(124,58,237,.18)");
  }, []);

  const base = items.filter(i => {
    if (sharedView && !i.shared) return false;
    if (kind === "library" && ratingFilter !== "all" && (i.rating || "seen") !== ratingFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const inTitle = (i.title || "").toLowerCase().includes(q);
      const inGenre = (i.genres || []).some(g => g.toLowerCase().includes(q));
      const inNet = (i.network || "").toLowerCase().includes(q);
      if (!inTitle && !inGenre && !inNet) return false;
    }
    return true;
  });

  const present = PROVIDERS.filter(p => base.some(i => matchesProvider(i, p)));
  const active = present.some(p => p.id === filter) ? filter : "all";
  const activeProv = PROVIDERS.find(p => p.id === active);
    const filteredByApp = active === "all" ? base : base.filter(i => matchesProvider(i, activeProv));
  const shown = [...filteredByApp].sort((a, b) => {
    if (sortBy === "score") return (b.communityScore || 0) - (a.communityScore || 0);
    if (sortBy === "year") return (b.year || 0) - (a.year || 0);
    if (sortBy === "az") return (a.title || "").localeCompare(b.title || "");
    return (b.t || 0) - (a.t || 0);
  });
  const pagedShown = shown.slice(0, visibleCount);

  const spinTonightPick = () => {
    if (!shown.length) return;
    const pool = shown.length > 1 && pickedShow ? shown.filter(s => s.id !== pickedShow.id || s.providerId !== pickedShow.providerId) : shown;
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setPickedShow(winner);
  };

  return (
    <div className="h-full flex flex-col max-w-xl md:max-w-none mx-auto w-full">
      <header className="px-5 pt-5 pb-3 md:px-8 md:pt-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="display text-4xl leading-none" style={{ fontWeight: 800, color: meta.color }}>{meta.title}</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {meta.blurb}: {items.length} {items.length === 1 ? "show" : "shows"}
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {kind === "watchlist" && shown.length > 0 && (
              <motion.button
                type="button"
                onClick={spinTonightPick}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.94 }}
                className="shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold"
                style={{ background: "var(--save)", color: "var(--bg)", boxShadow: "0 8px 20px -6px rgba(255,200,87,.5)" }}
              >
                <span>{"\uD83C\uDFB2"}</span>
                <span>Pick For Me</span>
              </motion.button>
            )}
            <div
              className="flex items-center gap-2 rounded-full px-3.5 py-2 flex-1 sm:w-60"
              style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ color: "var(--muted)" }} aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search shows"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                style={{ color: "var(--text)" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ color: "var(--muted)", background: "rgba(255,255,255,.08)" }}
                >
                  {"\u2715"}
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort shows"
              className="shrink-0 rounded-full px-3 py-2 text-xs font-bold outline-none cursor-pointer"
              style={{ background: "var(--surface)", color: "var(--text)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}
            >
              <option value="recent">Recent</option>
              <option value="score">{"\uD83C\uDF45"} Top Score</option>
              <option value="year">Newest</option>
              <option value="az">A–Z</option>
            </select>
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scroll px-5 pb-6 space-y-5 md:px-8 md:pb-10">
        {/* Tonight's Random Pick Spotlight Banner */}
        <AnimatePresence>
          {pickedShow && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className="rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                background: `linear-gradient(135deg, ${(pickedShow.colors && pickedShow.colors[0]) || "#6d28d9"}44, rgba(20,16,42,.95))`,
                boxShadow: "0 18px 40px -15px rgba(0,0,0,.7), inset 0 0 0 1.5px var(--save)",
              }}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <ProviderIcon name={pickedShow.network} size={44} shadow />
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--save)" }}>
                    {"\uD83C\uDFB2"} Tonight's Winner
                  </p>
                  <h3 className="display text-xl truncate" style={{ fontWeight: 800 }}>{pickedShow.title}</h3>
                  <p className="text-xs truncate" style={{ color: "var(--muted)" }}>
                    {pickedShow.year} • {(pickedShow.genres || []).join(", ")} • {pickedShow.seasons} {pickedShow.seasons === 1 ? "season" : "seasons"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => launchStream(pickedShow, pickedShow.network, showToast)}
                  className="flex-1 sm:flex-initial rounded-full px-4 py-2 text-xs font-extrabold"
                  style={{ background: "var(--seen)", color: "var(--bg)" }}
                >
                  Watch on {pickedShow.network}
                </button>
                <button
                  type="button"
                  onClick={() => launchTrailer(pickedShow, showToast)}
                  className="rounded-full px-3.5 py-2 text-xs font-bold"
                  style={{ background: "rgba(255,255,255,.12)" }}
                >
                  {"\uD83C\uDFAC"} Trailer
                </button>
                <button
                  type="button"
                  onClick={spinTonightPick}
                  title="Spin again"
                  className="rounded-full px-3 py-2 text-xs font-bold"
                  style={{ background: "rgba(255,255,255,.08)" }}
                >
                  {"\uD83C\uDFB2"}
                </button>
                <button
                  type="button"
                  onClick={() => setPickedShow(null)}
                  aria-label="Close spotlight"
                  className="rounded-full px-2.5 py-2 text-xs"
                  style={{ color: "var(--muted)" }}
                >
                  {"\u2715"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {guest && items.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: "rgba(255,200,87,.1)", boxShadow: "inset 0 0 0 1px rgba(255,200,87,.3)" }}>
            <p className="text-sm">You're browsing as a guest. Create a free account to keep your {kind === "library" ? "library" : "watchlist"}.</p>
            <button onClick={onAuth} className="shrink-0 rounded-full px-4 py-2 text-sm font-bold" style={{ background: "var(--save)", color: "var(--bg)" }}>Sign up</button>
          </div>
        )}

        {kind === "library" && (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start w-full">
            <StreamingDNA items={items} />
            <TopGenres items={items} />
          </div>
        )}

        {kind === "watchlist" && (
          <div>
            <div className="inline-flex p-1 rounded-full" style={{ background: "var(--surface)" }} role="group" aria-label="Watchlist view">
              {[
                { id: "all", label: "All Saved", n: items.length },
                { id: "shared", label: "Shared Matches", n: items.filter(i => i.shared).length },
              ].map(o => {
                const on = view === o.id;
                return (
                  <button
                    key={o.id}
                    onClick={() => setView(o.id)}
                    aria-pressed={on}
                    className="relative px-4 py-1.5 rounded-full text-sm font-bold"
                    style={{ color: on ? "var(--bg)" : "var(--muted)" }}
                  >
                    {on && (
                      <motion.span
                        layoutId="wl-seg"
                        className="absolute inset-0 rounded-full"
                        style={{ background: "var(--save)" }}
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative">{o.label}{o.n > 0 ? ` (${o.n})` : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {kind === "library" && items.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scroll -mx-5 px-5 md:mx-0 md:px-0" role="group" aria-label="Filter by rating">
            {[
              { id: "all", label: "All Seen", emoji: null },
              ...RATING_CHOICES.map(k => ({ id: k, label: RATINGS[k].label, emoji: RATINGS[k].emoji })),
            ].map(r => {
              const on = ratingFilter === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setRatingFilter(r.id)}
                  aria-pressed={on}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition"
                  style={{
                    background: on ? "var(--seen)" : "var(--surface)",
                    color: on ? "var(--bg)" : "var(--text)",
                  }}
                >
                  {r.emoji && <span>{r.emoji}</span>}
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {present.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scroll -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible" role="tablist" aria-label="Filter by streaming app">
            {[{ id: "all", name: "All Apps", count: base.length, accent: null }, ...present.map(p => ({ ...p, count: base.filter(i => matchesProvider(i, p)).length }))].map(p => {
              const on = active === p.id;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => setFilter(p.id)}
                  whileTap={{ scale: 0.92 }}
                  className="shrink-0 flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-full"
                  style={{ background: on ? "var(--text)" : "var(--surface)", color: on ? "var(--bg)" : "var(--text)" }}
                >
                  {p.accent && <ProviderIcon id={p.id} size={20} />}
                  <span>{p.name}</span>
                  <span className="text-xs opacity-70">({p.count})</span>
                </motion.button>
              );
            })}
          </div>
        )}

        {shown.length === 0 ? (
          <motion.div
            className="flex flex-col items-center text-center gap-5 px-6 py-10"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-base max-w-xs" style={{ color: "var(--muted)" }}>
              {query.trim()
                ? `No shows matching "${query}" in your ${kind === "library" ? "library" : "watchlist"}.`
                : sharedView
                ? "No shared matches yet. Start a Watch Match with a friend and the shows you both say yes to land here."
                : meta.empty}
            </p>
            <motion.button
              onClick={query.trim() ? () => setQuery("") : sharedView ? onOpenMatch : onDiscover}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.94 }}
              className="px-7 py-3 rounded-full display text-lg"
              style={{ background: "var(--text)", color: "var(--bg)", fontWeight: 800 }}
            >
              {query.trim() ? "Clear Search" : sharedView ? "Start a Watch Match" : "Go to Discover"}
            </motion.button>
          </motion.div>
        ) : (
          <>
            <p className="text-xs -mb-2" style={{ color: "var(--muted)" }}>
              {kind === "library"
                ? "Tap any poster to flip for synopsis, trailer & streaming links. Tap the rating badge to change it."
                : "Tap any poster to flip for synopsis, trailer, streaming links, or to mark it as seen."}
            </p>
            <motion.ul
              key={active + "-" + ratingFilter}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
            >
              {pagedShown.map(item => (
                <CollectionTile
                  key={item.providerId + "-" + item.id}
                  item={item}
                  kind={kind}
                  onRate={onRate}
                  onMoveToSeen={onMoveToSeen}
                  onRemove={onRemove}
                />
              ))}
            </motion.ul>
            {shown.length > visibleCount && (
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 36)}
                  className="px-6 py-2.5 rounded-full text-xs font-extrabold"
                  style={{ background: "var(--surface)", color: "var(--text)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                >
                  Show More ({shown.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export default Collection;