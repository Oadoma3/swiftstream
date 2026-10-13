// Card.jsx - Show cards: poster front, details back, 3D tap-to-flip wrapper, and the draggable swipe card.
import { useRef, useContext } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RATINGS } from "./data";
import { initials } from "./utils";
import { FlipIcon, InfoIcon, ProviderIcon, ToastCtx } from "./ui";

/* Rating badge (emoji, or a check for a plain "seen") */
function RatingBadge({ rating, size = 40 }) {
  const r = RATINGS[rating] || RATINGS.seen;
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      title={r.label}
      aria-label={r.label}
      style={{ width: size, height: size, background: "rgba(8,6,16,.8)", border: `2px solid ${r.color}`, color: r.color, fontSize: size * 0.5, fontWeight: 800, lineHeight: 1 }}
    >
      {r.emoji}
    </span>
  );
}

/* Front face. `compact` is the small grid version; `badge` replaces the info hint. */
export function PosterFace({ show, compact = false, badge = null, prominent = false }) {
  const [c1, c2] = show.colors;
  const genres = compact ? show.genres.slice(0, 2) : show.genres;
  const pill = { background: "rgba(8,6,16,.62)", border: "1px solid rgba(255,255,255,.14)" };
  const pillSize = compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
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
        className="display absolute left-0 right-0 text-center select-none"
        style={{ top: compact ? "20%" : "14%", fontSize: compact ? "5rem" : "9.5rem", fontWeight: 800, lineHeight: 1, color: "rgba(255,255,255,.2)" }}
        aria-hidden="true"
      >
        {initials(show.title)}
      </div>

      <div className={`absolute flex items-start justify-between gap-2 font-bold ${compact ? "top-2.5 left-2.5 right-2.5" : "top-4 left-4 right-4"}`}>
        <span
          className={`flex items-center gap-1.5 rounded-full ${compact ? "pl-0.5 pr-2 py-0.5 text-[10px]" : prominent ? "pl-1 pr-3.5 py-1 text-sm" : "p-0.5"}`}
          style={prominent ? { ...pill, background: "rgba(8,6,16,.8)", boxShadow: "0 6px 20px -6px rgba(0,0,0,.7)" } : pill}
          title={show.network}
        >
          <ProviderIcon name={show.network} size={compact ? 20 : prominent ? 44 : 30} shadow={prominent} />
          {(compact || prominent) && show.network}
        </span>
        {badge ? badge : (
          <span className={`flex items-center gap-1.5 rounded-full font-medium ${compact ? "p-1.5" : "px-2.5 py-1 text-xs"}`} style={{ ...pill, color: "rgba(255,255,255,.85)" }}>
            <InfoIcon /> {!compact && !prominent && "Tap for info"}
          </span>
        )}
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 ${compact ? "p-3 pt-16" : "p-5 pt-28"}`}
        style={{ background: "linear-gradient(to top, rgba(8,6,16,.95), rgba(8,6,16,.6) 55%, transparent)" }}
      >
        <h2
          className={`display leading-[1.02] text-white ${compact ? "text-[1.05rem]" : "text-[2.15rem]"}`}
          style={{ fontWeight: 800, textShadow: "0 2px 12px rgba(0,0,0,.5)" }}
        >
          {show.title}
        </h2>
        <div className={`flex flex-wrap font-bold ${compact ? "gap-1 mt-1.5" : "gap-1.5 mt-3"}`}>
          <span className={`rounded-full ${pillSize}`} style={{ background: "#fff", color: "#0f0c1b" }}>{show.year}</span>
          {genres.map(g => (
            <span key={g} className={`rounded-full ${pillSize}`} style={pill}>{g}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Back face */
export function BackFace({ show, compact = false }) {
  const [c1, c2] = show.colors;
  const showToast = useContext(ToastCtx);
  return (
    <div
      className={`absolute inset-0 overflow-hidden flex flex-col ${compact ? "rounded-[20px]" : "rounded-[28px]"}`}
      style={{
        background: `linear-gradient(165deg, ${c2} 0%, #14102a 80%)`,
        boxShadow: "0 30px 60px -20px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.12)",
      }}
    >
      <div className="h-1.5 shrink-0" style={{ background: `linear-gradient(90deg, ${c1}, transparent)` }} />
      <div className={`flex-1 min-h-0 flex flex-col ${compact ? "p-3" : "p-4"}`}>
        {!compact && (
          <div className="flex items-center justify-between text-[11px]" style={{ color: "rgba(255,255,255,.6)" }}>
            <span>{show.year}, {show.genres.join(", ")}</span>
            <span className="flex items-center gap-1"><FlipIcon /> Tap to flip back</span>
          </div>
        )}
        <h2 className={`display leading-tight text-white ${compact ? "text-[0.95rem]" : "text-xl mt-2"}`} style={{ fontWeight: 800 }}>{show.title}</h2>

        <p
          className={`leading-snug flex-1 min-h-0 overflow-hidden ${compact ? "text-[11px] mt-1.5" : "text-[13px] mt-2"}`}
          style={{ color: "rgba(255,255,255,.82)" }}
        >
          {show.synopsis}
        </p>

        {/* Affiliate CTA, directly beneath the synopsis */}
        <motion.button
          onClick={(e) => { e.stopPropagation(); showToast("Redirecting to affiliate link...", show.network); }}
          onKeyDown={(e) => e.stopPropagation()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          aria-label={`Watch ${show.title} on ${show.network}`}
          className={`w-full rounded-full font-extrabold shrink-0 flex items-center justify-center gap-2 text-white ${compact ? "mt-2 py-2 text-[11px]" : "mt-3 py-3 text-base"}`}
          style={{
            background: "linear-gradient(120deg, #0b7a73 0%, #6d28d9 100%)",
            boxShadow: "0 12px 30px -8px rgba(109,40,217,.8), 0 0 0 2px rgba(255,255,255,.28)",
            textShadow: "0 1px 2px rgba(0,0,0,.35)",
          }}
        >
          <svg width={compact ? 10 : 14} height={compact ? 10 : 14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>
          <span>Watch on {show.network}</span>
        </motion.button>

        <div className={`grid grid-cols-3 ${compact ? "gap-1 mt-1.5" : "gap-2 mt-2"}`}>
          {[
            { v: show.seasons, l: show.seasons === 1 ? "season" : "seasons" },
            { v: show.episodes, l: "episodes" },
            { v: show.communityScore != null ? (<><span className={compact ? "text-[11px]" : "text-sm"}>🍅</span> {show.communityScore}%</>) : "n/a", l: "score" },
          ].map(st => (
            <div
              key={st.l}
              className={`rounded-xl text-center ${compact ? "px-1 py-1" : "px-1.5 py-1.5"}`}
              style={{ background: "rgba(255,255,255,.08)" }}
            >
              <div className={`display leading-none whitespace-nowrap ${compact ? "text-[13px]" : "text-base"}`} style={{ fontWeight: 800 }}>{st.v}</div>
              <div className={`mt-0.5 ${compact ? "text-[9px]" : "text-[11px]"}`} style={{ color: "rgba(255,255,255,.6)" }}>{st.l}</div>
            </div>
          ))}
        </div>

        <p className={`text-[11px] ${compact ? "mt-1.5" : "mt-2.5"}`} style={{ color: "rgba(255,255,255,.6)" }}>Available on</p>
        <div className={`flex flex-wrap ${compact ? "gap-1.5 mt-1" : "gap-3 mt-1.5"}`}>
          {show.platforms.map(pl => (
            <div key={pl} className="flex flex-col items-center gap-0.5">
              <ProviderIcon name={pl} size={compact ? 28 : 36} shadow />
              {!compact && <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,.75)" }}>{pl}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Reusable 3D tap-to-flip wrapper (used by the swipe deck, Library and Watchlist) */
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

/* ---------- Swipeable top card ---------- */
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