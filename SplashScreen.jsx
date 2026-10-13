// SplashScreen.jsx - Branded loading screen shown on first mount, then fades out to reveal the app.
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ProviderIcon } from "./ui";

const SPLASH_MS = 1800;
const SPLASH_TILES = ["netflix", "hulu", "prime", "disney", "max"];

export default function SplashScreen({ onDone, duration = SPLASH_MS }) {
  // Keep the latest callback without restarting the timer on re-renders.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    document.documentElement.style.setProperty("--glow", "rgba(124,58,237,.35)");
    const id = setTimeout(() => doneRef.current(), duration);
    return () => clearTimeout(id);
  }, [duration]);

  return (
    <motion.div
      data-splash="true"
      role="status"
      aria-live="polite"
      aria-label="Loading SwiftStream"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "var(--bg)" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.35 }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(60% 40% at 50% 42%, rgba(124,58,237,.3), transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-center gap-3" aria-hidden="true">
        {SPLASH_TILES.map((id, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, scale: 0.6, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 + i * 0.09 }}
          >
            <ProviderIcon id={id} size={52} shadow />
          </motion.div>
        ))}
      </div>

      <motion.h1
        className="relative display text-5xl mt-8"
        style={{ fontWeight: 800 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        SwiftStream
      </motion.h1>
      <motion.p
        className="relative text-base mt-2"
        style={{ color: "var(--muted)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.4 }}
      >
        Sort what you've watched
      </motion.p>

      <div className="relative mt-10 h-1.5 rounded-full overflow-hidden" style={{ width: "min(220px, 60vw)", background: "rgba(255,255,255,.12)" }} aria-hidden="true">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--seen)" }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: duration / 1000, ease: "easeInOut" }}
        />
      </div>

      <button
        onClick={() => doneRef.current()}
        className="relative mt-6 text-xs font-medium underline"
        style={{ color: "var(--muted)" }}
      >
        Skip
      </button>
    </motion.div>
  );
}