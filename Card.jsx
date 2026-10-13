// Card.jsx - Mobile-first show cards: HD poster front, high-legibility synopsis back, trailer + streaming launchers.
import { useState, useEffect, useRef, useContext } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
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
  "ESPN+": (q) => `https://plus.espn.com/search?q=${encodeURIComponent(q)}`,
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

// Runtime memory map prevents duplicate API calls. Native browser HTTP cache handles the actual images.
const posterMemory = new Map();
const posterPending = new Map();

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
          return img;
        })
        .catch(() => "")
        .finally(() => posterPending.delete(cleanTitle));
      posterPending.set(cleanTitle, p);
    }
    posterPending.get(cleanTitle).then(img => { if (alive && img) setUrl(img); });
    return () => { alive = false; };
  }, [cleanTitle]);

  return url;
}

export function PosterFace({ show, compact = false, badge = null, prominent = false }) {
  const [c1, c2] = show.colors || ["#4338ca", "#0f0a24"];
  const genres = compact ? (show.genres || []).slice(0, 2) : (show.genres || []).slice(0, 3);
  const pill = { background: "rgba(8,6,16,.76)", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(8px)" };
  const pillSize = compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  const fetchedPoster = useShowPoster(show.posterUrl ? "" : show.title);
  const posterUrl = show.posterUrl || fetchedPoster;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${compact ? "rounded-[20px]" : "rounded-[26px]"}`}
      style={{
        background: "linear-gradient(160deg, #16122b 0%, #080610 100%)",
        boxShadow: "0 26px 50px -18px rgba(0,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.14)",
      }}
    >
      <div
        className="display absolute left-0 right-0 text-center select-none transition-opacity duration-300"
        style={{
          top: compact ? "22%" : "16%",
          fontSize: compact ? "4.2rem" : "8rem",
          fontWeight: 800,
          lineHeight: 1,
          color: "rgba(255,255,255,.18)",
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
          loading={compact ? "lazy" : "eager"}
          decoding="async"
          draggable={false}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgLoaded(false)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-300"
          style={{ opacity: imgLoaded ? 1 : 0 }}
        />
      )}

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: imgLoaded
            ? "linear-gradient(to bottom, rgba(8,6,16,.55) 0%, rgba(8,6,16,.02) 32%, rgba(8,6,16,.35) 60%, rgba(8,6,16,.96) 92%)"
            : "linear-gradient(to top, rgba(8,6,16,.95), rgba(8,6,16,.55) 55%, transparent)",
        }}
      />

      <div className={`absolute flex items-start justify-between gap-2 font-bold ${compact ? "top-2.5 left-2.5 right-2.5" : "top-3.5 left-3.5 right-3.5"}`}>
        <span
          className={`flex items-center gap-1.5 rounded-full ${compact ? "pl-0.5 pr-2 py-0.5 text-[10px]" : "pl-1 pr-3 py-1 text-xs"}`}
          style={{ ...pill, background: "rgba(8,6,16,.84)" }}
          title={show.network}
        >
          <ProviderIcon name={show.network} size={compact ? 18 : 28} shadow />
          <span className="truncate max-w-[105px]">{show.network}</span>
        </span>
        {badge ? badge : (
          <span className={`flex items-center gap-1 rounded-full font-semibold ${compact ? "p-1.5" : "px-2.5 py-1 text-xs"}`} style={{ ...pill, color: "#fff" }}>
            <InfoIcon /> {!compact && "Details"}
          </span>
        )}
      </div>

      <div className={`absolute inset-x-0 bottom-0 ${compact ? "p-3 pt-10" : "p-4 sm:p-5 pt-16"}`}>
        <h2
          className={`display leading-[1.05] text-white ${compact ? "text-[1rem] line-clamp-2" : "text-[1.75rem] sm:text-[2.05rem] line-clamp-2"}`}
          style={{ fontWeight: 800, textShadow: "0 2px 14px rgba(0,0,0,.9)" }}
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

/* Back face: Designed specifically for phone readability */
export function BackFace({ show, compact = false, onMarkSeen = null, onRemove = null }) {
  const [c1, c2] = show.colors || ["#4338ca", "#0f0a24"];
  const showToast = useContext(ToastCtx);
  const seasonsLabel = `${show.seasons || 1} ${(show.seasons || 1) === 1 ? "Season" : "Seasons"}`;

  return (
    <div
      className={`absolute inset-0 overflow-hidden flex flex-col ${compact ? "rounded-[20px]" : "rounded-[26px]"}`}
      style={{
        background: "linear-gradient(165deg, #1a1533 0%, #080610 88%)",
        boxShadow: "0 26px 50px -18px rgba(0,0,0,.75), inset 0 0 0 1px rgba(255,255,255,.16)",
      }}
    >
      <div className="h-1.5 shrink-0" style={{ background: "linear-gradient(165deg, #1a1533 0%, #080610 88%)" }} />

      <div className={`flex-1 min-h-0 flex flex-col ${compact ? "p-2.5" : "p-4 sm:p-5"}`}>
        {/* Header: Title + Flip */}
        <div className="flex items-start justify-between gap-2 shrink-0">
          <h2
            className={`display leading-tight text-white ${compact ? "text-[0.92rem] line-clamp-1" : "text-xl sm:text-2xl line-clamp-2"}`}
            style={{ fontWeight: 800 }}
          >
            {show.title}
          </h2>
          {!compact && (
            <span
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}
            >
              <FlipIcon /> Flip
            </span>
          )}
        </div>

        {/* Single-line quick stats */}
        <div className={`flex flex-wrap items-center gap-1.5 shrink-0 ${compact ? "mt-1 text-[10px]" : "mt-2 text-xs"} font-bold`}>
          {show.communityScore != null && (
            <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(92,225,196,.18)", color: "var(--seen)" }}>
              {"\uD83C\uDF45"} {show.communityScore}%
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.1)", color: "#fff" }}>
            {show.year}
          </span>
          <span className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.9)" }}>
            {seasonsLabel}
          </span>
          {!compact && (show.genres || []).slice(0, 2).map(g => (
            <span key={g} className="px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.78)" }}>
              {g}
            </span>
          ))}
        </div>

        {/* High-Contrast, Easy-to-Read Synopsis Box */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto pr-1 ${compact ? "mt-1.5" : "mt-3"} rounded-xl`}
          style={{ WebkitOverflowScrolling: "touch" }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <p
            className={compact ? "text-[11.5px] leading-[1.38]" : "text-[15px] leading-[1.55]"}
            style={{ color: "rgba(255,255,255,.95)" }}
          >
            {show.synopsis || "No description available."}
          </p>
        </div>

        {/* Bottom Actions */}
        <div className={`flex items-center gap-1.5 shrink-0 ${compact ? "mt-1.5" : "mt-3"}`}>
          <motion.button
            type="button"
            onClick={(e) => { e.stopPropagation(); launchStream(show, show.network, showToast); }}
            onKeyDown={(e) => e.stopPropagation()}
            whileTap={{ scale: 0.95 }}
            className={`flex-1 min-w-0 rounded-full font-extrabold flex items-center justify-center gap-1.5 text-white ${compact ? "py-1.5 px-2 text-[10.5px]" : "py-2.5 px-3.5 text-sm"}`}
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
            whileTap={{ scale: 0.94 }}
            title="Watch Official Trailer"
            className={`shrink-0 rounded-full font-bold flex items-center justify-center gap-1 ${compact ? "py-1.5 px-2 text-[10.5px]" : "py-2.5 px-3.5 text-xs"}`}
            style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" }}
          >
            <span>{"\uD83C\uDFAC"}</span>
            {!compact && <span>Trailer</span>}
          </motion.button>
        </div>

        {(onMarkSeen || onRemove) && (
          <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
            {onMarkSeen && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMarkSeen(); }}
                className="flex-1 rounded-full py-1 px-2 text-[10px] font-extrabold truncate"
                style={{ background: "rgba(92,225,196,.18)", color: "var(--seen)", border: "1px solid rgba(92,225,196,.4)" }}
              >
                {"\u2713"} Seen
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="rounded-full py-1 px-2.5 text-[10px] font-bold"
                style={{ background: "rgba(255,107,122,.15)", color: "var(--skip)", border: "1px solid rgba(255,107,122,.35)" }}
              >
                {"\u2715"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
        <div className="absolute inset-0" style={{ ...face, pointerEvents: flipped ? "none" : "auto" }}>{front}</div>
        <div className="absolute inset-0" style={{ ...face, transform: "rotateY(180deg)", pointerEvents: flipped ? "auto" : "none" }}>{back}</div>
      </motion.div>
    </div>
  );
}

const cardVariants = {
  enter: { scale: 0.92, y: 24, opacity: 0 },
  center: { scale: 1, y: 0, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 30 } },
  exit: (dir) => ({
    x: dir === "seen" ? 520 : dir === "skip" ? -520 : 0,
    y: dir === "save" ? -640 : dir === "undo" ? 80 : 0,
    rotate: dir === "seen" ? 16 : dir === "skip" ? -16 : 0,
    opacity: 0,
    scale: dir === "undo" ? 0.9 : 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.9, 0.5] },
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
    const { x: vx, y: vy } = info.velocity;
    const flickUp = (dy < -95 || (dy < -40 && vy < -480)) && Math.abs(dy) > Math.abs(dx);
    const flickRight = dx > 95 || (dx > 40 && vx > 450);
    const flickLeft = dx < -95 || (dx < -40 && vx < -450);

    if (flickUp) onDecide("save");
    else if (flickRight) onDecide("seen");
    else if (flickLeft) onDecide("skip");
  };

  const Stamp = ({ opacity, text, color, rot, pos }) => (
    <motion.div
      className={`absolute ${pos} px-4 py-1.5 rounded-xl display text-2xl pointer-events-none`}
      style={{ opacity, color, border: `3px solid ${color}`, rotate: rot, background: "rgba(8,6,16,.65)", fontWeight: 800, zIndex: 5 }}
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
      drag={true}
      dragSnapToOrigin
      dragElastic={0.9}
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => { dragging.current = true; }}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
    >
      <FlipCard
        front={<PosterFace show={show} prominent={mixed} />}
        back={<BackFace show={show} />}
        flipped={flipped}
        onTap={onFlip}
        ignoreTap={() => dragging.current}
        label={flipped ? `${show.title}: details. Activate to show the poster.` : `${show.title}. Activate for details.`}
      />
      <Stamp opacity={seenOpacity} text={labels.right} color="var(--seen)" rot={-10} pos="top-14 left-4" />
      <Stamp opacity={skipOpacity} text={labels.left} color="var(--skip)" rot={10} pos="top-14 right-4" />
      <Stamp opacity={saveOpacity} text={labels.up} color="var(--save)" rot={0} pos="top-1/3 left-1/2 -translate-x-1/2" />
    </motion.div>
  );
}
export default SwipeCard;