// SplashScreen.jsx - Animated branding boot screen
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function SplashScreen({ onDone }) {
  // Hold the splash screen for 2.2 seconds before revealing the app
  useEffect(() => {
    const timer = setTimeout(onDone, 2200);
    return () => clearTimeout(timer);
  }, [onDone]);

  const cardVariants = {
    initial: { y: 40, opacity: 0, rotate: 0, scale: 0.8 },
    animate: (i) => ({
      y: 0,
      opacity: 1,
      rotate: i === 0 ? -22 : i === 2 ? 22 : 0,
      x: i === 0 ? -42 : i === 2 ? 42 : 0,
      scale: i === 1 ? 1.05 : 0.95,
      transition: { type: "spring", stiffness: 350, damping: 22, delay: 0.1 + (i * 0.1) }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden touch-none"
      style={{ background: "#080610" }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)", transition: { duration: 0.5, ease: "easeInOut" } }}
    >
      <div className="relative flex items-center justify-center w-40 h-40 mb-4">
        {/* Left Card (Not Seen / Skip) */}
        <motion.div
          custom={0}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          className="absolute w-20 h-28 rounded-2xl border border-white/20"
          style={{ background: "linear-gradient(135deg, #ff6b7a, #880000)", boxShadow: "0 10px 30px -10px rgba(255,107,122,0.5)" }}
        />
        
        {/* Right Card (Seen) */}
        <motion.div
          custom={2}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          className="absolute w-20 h-28 rounded-2xl border border-white/20"
          style={{ background: "linear-gradient(135deg, #5ce1c4, #0b7a73)", boxShadow: "0 10px 30px -10px rgba(92,225,196,0.5)" }}
        />
        
        {/* Center Card (Streaming Play Button) */}
        <motion.div
          custom={1}
          variants={cardVariants}
          initial="initial"
          animate="animate"
          className="absolute w-20 h-28 rounded-2xl border border-white/20 z-10 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #8f5bff, #6d28d9)", boxShadow: "0 15px 40px -5px rgba(109,40,217, 0.7)" }}
        >
          <motion.svg
            width="28" height="28" viewBox="0 0 24 24" fill="white"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.5 }}
          >
            <path d="M6 4l14 8-14 8z" />
          </motion.svg>
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.5, ease: "easeOut" }}
        className="display text-4xl leading-none tracking-wide"
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
      
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6, ease: "easeOut" }}
        className="mt-3 h-[2px] w-12 rounded-full"
        style={{ background: "linear-gradient(90deg, #ff6b7a, #8f5bff, #5ce1c4)" }}
      />
    </motion.div>
  );
}