// Card.jsx - Show cards: HD poster front, spacious mobile-first details back, trailer + streaming launchers.
import { useState, useEffect, useRef, useContext } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RATINGS } from "./data";
import { initials } from "./utils";
import { FlipIcon, InfoIcon, ProviderIcon, ToastCtx } from "./ui";

const STREAM_URLS = {
  "Netflix": (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  "Hulu": (q) => `https://www.hulu.com/search?q=${encodeURIComponent(q)}`,
  "Prime Video": (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=instant-video`,
  "Peacock": (q) => `https://www.peacocktv.com/watch/search?q=${encodeURIComponent(q)}`,
  "Paramount+": (q) => `https://www.paramountplus.com/search/?q=${encodeURIComponent(q)}`,
  "Disney+": (q) => `https://www.disneyplus.com/search?q=${encodeURIComponent(q)}`,
  "Max": (q) => `https://play.max.com/search?q=${encodeURIComponent(q)}`,
  "Apple TV+": (q) => `https://tv.apple.com/search?term=${encodeURIComponent(q)}`,
  "Tubi": (q) => `https://tubitv.com/search/${encodeURIComponent(q)}`,
  "Crunchyroll": (q) => `https://www.crunchyroll.com/search?q=${encodeURIComponent(q)}`,
  "Starz": (q) => `https://www.starz.com/us/en/search?q=${encodeURIComponent(q)}`,
  "AMC+": (q) => `https://www.amcplus.com/search?q=${encodeURIComponent(q)}`,
  "Discovery+": (q) => `https://www.discoveryplus.com/search?q=${encodeURIComponent(q)}`,
  "Pluto TV": (q) => `https://pluto.tv/us/search/details/${encodeURIComponent(q)}`,
  "Roku Channel": (q) => `https://therokuchannel.roku.com/search/${encodeURIComponent(q)}`,
  "Shudder": (q) => `https://www.shudder.com/search?q=${encodeURIComponent(q)}`,
  "ESPN+": (q) => `https://plus.espn.com/search?q=${encodeURIComponent(q)}`,
  "BritBox": (q) => `https://www.britbox.com/us/search?q=${encodeURIComponent(q)}`,
};

export function launchStream(show, targetNetwork, showToast) {
  const net = targetNetwork || (show && show.network) || "Netflix";
  const title = (show && show.title) || "";
  if (showToast) showToast(`Opening ${title} on ${net}...`, net);
  const direct = !targetNetwork && (show?.watchUrl || show?.url || show?.link);
  const url = direct || (STREAM_URLS[net] ? STREAM_URLS[net](title) : `https://www.google.com/search?q=${encodeURIComponent("Watch " + title + " on " + net)}`);
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export function launchTrailer(show, showToast) {
  const title = (show && show.title) || "";
  const year = (show && show.year) || "";
  if (showToast) showToast(`Opening ${title} trailer...`, "YouTube");
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title}${year} official trailer`)}`;
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/* ---------- Live Poster Cache ---------- */
const POSTER_STORAGE_KEY = "swiftstream-posters-v1";
const posterMemory = new Map();
const posterPending = new Map();

try {
  const raw = typeof window !== "undefined" ? window.localStorage.getItem(POSTER_STORAGE_KEY) : null;
  if (raw) {
    Object.entries(JSON.parse(raw)).forEach(([k, v]) => posterMemory.set(k, v));
  }
} catch { /* ignore */ }

function savePosterCache() {
  try {
    const obj = Object.fromEntries(posterMemory.entries());
    window.localStorage.setItem(POSTER_STORAGE_KEY, JSON.stringify(obj));
  } catch { /* ignore */ }
}

export function useShowPoster(title) {
  const cleanTitle = (title || "").replace(/\s*\(.*?\)\s*/g, "").trim();
  const [url, setUrl] = useState(() => (cleanTitle && posterMemory.get(cleanTitle)) || null);

  useEffect(() => {
    if (!cleanTitle) return;
    if (posterMemory.has(cleanTitle)) {
      setUrl(posterMemory.get(cleanTitle));
      return;
    }
    let alive = true;
    if (!posterPending.has(cleanTitle)) {
      const p = fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const img = (d && d.image && (d.image.original || d.image.medium)) ? (d.image.original || d.image.medium).replace(/^http:/, "https:") : "";
          posterMemory.set(cleanTitle, img);
          savePosterCache();
          return img;
        })
        .catch(() => "")
        .finally(() => posterPending.delete(cleanTitle));
      posterPending.set(cleanTitle, p);
    }
    posterPending.get(cleanTitle).then(img => {
      if (alive && img) setUrl(img);
    });
    return () => { alive = false; };
  }, [cleanTitle]);

  return url;
}

/* Front face */
export function PosterFace({ show, compact = false, badge = null, prominent = false }) {
  const [c1, c2] = show.colors || ["#4338ca", "#0f0a24"];
  const genres = compact ? (show.genres || []).slice(0, 2) : (show.genres || []).slice(0, 3);
  const pill = { background: "rgba(8,6,16,.75)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(8px)" };
  const pillSize = compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const fetchedPoster = useShowPoster(show.posterUrl ? "" : show.title);
  const posterUrl = show.posterUrl || fetchedPoster;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${compact ? "rounded-[20px]" : "rounded-[28px]"}`}
      style={{
        background: `radial-gradient(circle at 18% 12%, rgba(255,255,255,.28), transparent 42%), linear-gradient(160deg, ${c1}, ${c2})`,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.12)",
      }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <circle cx="230" cy="120" r="110" fill="rgba(255,255,255,.07)" />
        <circle cx="60" cy="230" r="70" fill="rgba(0,0,0,.14)" />
        <rect x="-40" y="260" width="380" height="14" transform="rotate(-12 150 267)" fill="rgba(255,255,255,.08)" />
        <rect x="-40" y="290" width="380" height="6" transform="rotate(-12 150 293)" fill="rgba(255,255,255,.06)" />
      </svg>
      <div
        className="display absolute left-0 right-0 text-center select-none transition-opacity duration-300"
        style={{
          top: compact ? "20%" : "14%",
          fontSize: compact ? "4.5rem" : "8.5rem",
          fontWeight: 800,
          lineHeight: 1,
          color: "rgba(255,255,255,.2)",
          opacity: imgLoaded ? 0 : 1,
        }}
        aria-hidden="true"
      >
        {initials(show.title)}
      </div>

      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-500"
          style={{ opacity: imgLoaded ? 1 : 0 }}
        />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: imgLoaded
            ? "linear-gradient(to bottom, rgba(8,6,16,.6) 0%, rgba(8,6,16,.05) 30%, rgba(8,6,16,.3) 58%, rgba(8,6,16,.96) 92%)"
            : "linear-gradient(to top, rgba(8,6,16,.95), rgba(8,6,16,.6) 55%, transparent)",
        }}
      />

      <div className={`absolute flex items-start justify-between gap-2 font-bold ${compact ? "top-2.5 left-2.5 right-2.5" : "top-3.5 left-3.5 right-3.5"}`}>
        <span
          className={`flex items-center gap-1.5 rounded-full ${compact ? "pl-0.5 pr-2 py-0.5 text-[10px]" : prominent ? "pl-1 pr-3 py-1 text-xs" : "p-0.5"}`}
          style={prominent ? { ...pill, background: "rgba(8,6,16,.84)", boxShadow: "0 6px 20px -6px rgba(0,0,0,.7)" } : pill}
          title={show.network}
        >
          <ProviderIcon name={show.network} size={compact ? 20 : prominent ? 36 : 28} shadow={prominent} />
          {(compact || prominent) && <span className="truncate max-w-[90px]">{show.network}</span>}
        </span>
        {badge ? badge : (
          <span className={`flex items-center gap-1 rounded-full font-medium ${compact ? "p-1.5" : "px-2.5 py-1 text-[11px]"}`} style={{ ...pill, color: "rgba(255,255,255,.9)" }}>
            <InfoIcon /> {!compact && !prominent && "Info"}
          </span>
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${compact ? "p-3 pt-10" : "p-4 sm:p-5 pt-16"}`}>
        <h2
          className={`display leading-[1.04] text-white ${compact ? "text-[1rem] line-clamp-2" : "text-[1.65rem] sm:text-[2rem] line-clamp-2"}`}
          style={{ fontWeight: 800, textShadow: "0 2px 14px rgba(0,0,0,.85)" }}
        >
          {show.title}
        </h2>
        <div className={`flex flex-wrap font-bold ${compact ? "gap-1 mt-1.5" : "gap-1.5 mt-2.5"}`}>
          <span className={`rounded-full ${pillSize}`} style={{ background: "#fff", color: "#0f0c1b" }}>{show.year}</span>
          {genres.map(g => (
            <span key={g} className={`rounded-full ${pillSize}`} style={pill}>{g}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Back face: un-bunched layout with huge readable synopsis space and compact inline metadata */
export function BackFace({ show, compact = false, onMarkSeen = null, onRemove = null }) {
  const [c1, c2] = show.colors || ["#4338ca", "#0f0a24"];
  const showToast = useContext(ToastCtx);
  const platforms = show.platforms && show.platforms.length ? show.platforms : [show.network];
  const seasonsLabel = `${show.seasons || 1} ${(show.seasons || 1) === 1 ? "Season" : "Seasons"}`;
  const epsLabel = show.episodes ? `${show.episodes} Eps` : null;

  return (
    <div
      className={`absolute inset-0 overflow-hidden flex flex-col ${compact ? "rounded-[20px]" : "rounded-[28px]"}`}
      style={{
        background: `linear-gradient(165deg, ${c2} 0%, #100c24 85%)`,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.14)",
      }}
    >
      <div className="h-1.5 shrink-0" style={{ background: `linear-gradient(90deg, ${c1}, transparent)` }} />

      <div className={`flex-1 min-h-0 flex flex-col ${compact ? "p-3" : "p-4 sm:p-5"}`}>
        {/* Title + Flip Header */}
        <div className="flex items-start justify-between gap-2 shrink-0">
          <h2
            className={`display leading-tight text-white ${compact ? "text-[0.95rem] line-clamp-1" : "text-lg sm:text-xl line-clamp-2"}`}
            style={{ fontWeight: 800 }}
          >
            {show.title}
          </h2>
          {!compact && (
            <span
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)" }}
            >
              <FlipIcon /> Flip
            </span>
          )}
        </div>

        {/* Single-Line Compact Stats Pill Row (frees up 80px+ for the description!) */}
        <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${compact ? "mt-1 text-[10px]" : "mt-2 text-xs"} font-bold`}>
          {show.communityScore != null && (
            <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(92,225,196,.16)", color: "var(--seen)" }}>
              {"\uD83C\uDF45"} {show.communityScore}%
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>
            {show.year}
          </span>
          <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.85)" }}>
            {seasonsLabel}{!compact && epsLabel ? ` \u2022 ${epsLabel}` : ""}
          </span>
          {!compact && (show.genres || []).slice(0, 2).map(g => (
            <span key={g} className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)" }}>
              {g}
            </span>
          ))}
        </div>

        {/* Spacious, Thumb-Scrollable Synopsis Box */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto pr-1 ${compact ? "mt-2" : "mt-3"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <p
            className={`${compact ? "text-[11.5px] leading-snug" : "text-[13.5px] sm:text-sm leading-relaxed"}`}
            style={{ color: "rgba(255,255,255,.92)" }}
          >
            {show.synopsis || "No synopsis available for this title."}
          </p>
        </div>

        {/* Watch + Trailer CTA Row */}
        <div className={`flex items-center gap-1.5 shrink-0 ${compact ? "mt-2" : "mt-3"}`}>
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); launchStream(show, show.network, showToast); }}
            onKeyDown={(e) => e.stopPropagation()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 min-w-0 rounded-full font-extrabold flex items-center justify-center gap-1.5 text-white ${compact ? "py-1.5 px-2 text-[11px]" : "py-2.5 px-3 text-sm"}`}
            style={{
              background: "linear-gradient(120deg, #0b7a73 0%, #6d28d9 100%)",
              boxShadow: "0 10px 22px -8px rgba(109,40,217,.8), 0 0 0 1px rgba(255,255,255,.24)",
            }}
          >
            <svg width={compact ? 9 : 12} height={compact ? 9 : 12} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>
            <span className="truncate">{compact ? show.network : `Watch on ${show.network}`}</span>
          </motion.button>

          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); launchTrailer(show, showToast); }}
            onKeyDown={(e) => e.stopPropagation()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            title={`Watch ${show.title} Trailer on YouTube`}
            className={`shrink-0 rounded-full font-bold flex items-center justify-center gap-1 ${compact ? "py-1.5 px-2.5 text-[11px]" : "py-2.5 px-3.5 text-xs"}`}
            style={{ background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.18)" }}
          >
            <span>{"\uD83C\uDFAC"}</span>
            {!compact && <span>Trailer</span>}
          </motion.button>
        </div>

        {/* Bottom row: either Mark Seen / Remove (in Watchlist/Library) OR extra platforms */}
        {(onMarkSeen || onRemove) ? (
          <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
            {onMarkSeen && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMarkSeen(); }}
                className="flex-1 rounded-full py-1 px-2 text-[10.5px] font-extrabold truncate"
                style={{ background: "rgba(92,225,196,.18)", color: "var(--seen)", border: "1px solid rgba(92,225,196,.4)" }}
              >
                {"\u2713"} Seen
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="rounded-full py-1 px-2.5 text-[10.5px] font-bold"
                style={{ background: "rgba(255,107,122,.15)", color: "var(--skip)", border: "1px solid rgba(255,107,122,.35)" }}
              >
                {"\u2715"}
              </button>
            )}
          </div>
        ) : (!compact && platforms.length > 1 && (
          <div className="flex items-center gap-1.5 mt-2 shrink-0 overflow-x-auto no-scroll">
            <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,.55)" }}>Also on:</span>
            {platforms.map(pl => (
              <button
                key={pl}
                type="button"
                onClick={(e) => { e.stopPropagation(); launchStream(show, pl, showToast); }}
                className="flex items-center gap-1 rounded-full pr-2 pl-0.5 py-0.5 shrink-0"
                style={{ background: "rgba(255,255,255,.08)" }}
              >
                <ProviderIcon name={pl} size={16} />
                <span className="text-[10px] font-bold">{pl}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Reusable 3D tap-to-flip wrapper */
export function FlipCard({ front, back, flipped, onTap, ignoreTap, label, className = "absolute inset-0" }) {
  const face = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  const tap = () => {
    if (ignoreTap && ignoreTap()) return;
    if (onTap) onTap();
  };
  return (
    <div
      className={className}
      style={{ perspective: 1200 }}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={label}
      onClick={tap}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(); } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 190, damping: 22 }}
      >
        <div className="absolute inset-0" style={face}>{front}</div>
        <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)" }}>{back}</div>
      </motion.div>
    </div>
  );
}

const cardVariants = {
  enter: { scale: 0.92, y: 28, opacity: 0 },
  center: { scale: 1, y: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 30 } },
  exit: (dir) => ({
    x: dir === "seen" ? 520 : dir === "skip" ? -520 : 0,
    y: dir === "save" ? -640 : dir === "undo" ? 80 : 0,
    rotate: dir === "seen" ? 16 : dir === "skip" ? -16 : 0,
    opacity: 0,
    scale: dir === "undo" ? 0.9 : 1,
    transition: { duration: 0.32, ease: [0.4, 0, 0.9, 0.5] },
  }),
};

export function SwipeCard({ show, dir, flipped, onFlip, onDecide, mixed = false, labels = { right: "Seen it", left: "Not seen", up: "Save" } }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-13, 13]);
  const seenOpacity = useTransform(x, [30, 130], [0, 1]);
  const skipOpacity = useTransform(x, [-130, -30], [1, 0]);
  const saveOpacity = useTransform(y, [-30, -120], [0, 1]);
  const dragging = useRef(false);

  const handleDragEnd = (_, info) => {
    setTimeout(() => { dragging.current = false; }, 60);
    const { x: dx, y: dy } = info.offset;
    if (dy < -110 && Math.abs(dy) > Math.abs(dx)) onDecide("save");
    else if (dx > 110) onDecide("seen");
    else if (dx < -110) onDecide("skip");
  };

  const Stamp = ({ opacity, text, color, rot, pos }) => (
    <motion.div
      className={`absolute ${pos} px-4 py-1.5 rounded-xl display text-2xl pointer-events-none`}
      style={{ opacity, color, border: `3px solid ${color}`, rotate: rot, background: "rgba(8,6,16,.55)", fontWeight: 800, zIndex: 5 }}
    >
      {text}
    </motion.div>
  );

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
      style={{ x, y, rotate }}
      custom={dir}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag
      dragSnapToOrigin
      dragElastic={0.9}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragStart={() => { dragging.current = true; }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.03 }}
    >
      <FlipCard
        front={<PosterFace show={show} prominent={mixed} />}
        back={<BackFace show={show} />}
        flipped={flipped}
        onTap={onFlip}
        ignoreTap={() => dragging.current}
        label={flipped ? `${show.title}: details. Activate to show the poster.` : `${show.title}. Activate for details.`}
      />
      <Stamp opacity={seenOpacity} text={labels.right} color="var(--seen)" rot={-10} pos="top-16 left-5" />
      <Stamp opacity={skipOpacity} text={labels.left} color="var(--skip)" rot={10} pos="top-16 right-5" />
      <Stamp opacity={saveOpacity} text={labels.up} color="var(--save)" rot={0} pos="top-1/3 left-1/2 -translate-x-1/2" />
    </motion.div>
  );
}
export default SwipeCard;