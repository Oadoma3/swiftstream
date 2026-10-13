// Nav.jsx - Responsive navigation: bottom bar on phones, left sidebar from 768px.
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getSupabase, isSupabaseConfigured, hasStoredSession, AUTH_STORAGE_KEY } from "./supabase";

/* ---------- Bottom navigation ---------- */
const NavBookmark = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1z"/></svg>
);
const NavCompass = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>
);
const NavLibrary = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M14.5 17l2 2 4-4.5"/></svg>
);

const NAV_TABS = [
  { id: "watchlist", label: "Watchlist",  Icon: NavBookmark, color: "var(--save)" },
  { id: "discover",  label: "Discover",   Icon: NavCompass,  color: "var(--text)" },
  { id: "library",   label: "My Library", Icon: NavLibrary,  color: "var(--seen)" },
];

export function BottomNav({ tab, onTab, counts }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{
        background: "rgba(15,12,27,.94)",
        backdropFilter: "blur(14px)",
        borderTop: "1px solid rgba(255,255,255,.08)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      }}
    >
      <div className="max-w-xl mx-auto grid grid-cols-3 px-3 py-1.5">
        {NAV_TABS.map(t => {
          const on = tab === t.id;
          const count = counts[t.id] || 0;
          return (
            <motion.button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={on ? "page" : undefined}
              whileTap={{ scale: 0.88 }}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-2xl"
              style={{ color: on ? t.color : "var(--muted)" }}
            >
              {on && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-x-3 inset-y-0.5 rounded-2xl"
                  style={{ background: "var(--surface)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex items-center justify-center h-7">
                <t.Icon />
                {count > 0 && t.id !== "discover" && (
                  <motion.span
                    key={count}
                    className="absolute -top-1.5 -right-3.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center"
                    style={{ background: t.color, color: "var(--bg)" }}
                    initial={{ scale: 1.7 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16 }}
                  >
                    {count}
                  </motion.span>
                )}
              </span>
              <span className="relative text-[11px] font-medium">{t.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Left sidebar (768px and wider) ---------- */
const SIDE_TABS = ["discover", "watchlist", "library"].map(id => NAV_TABS.find(t => t.id === id));

export function SideNav({ tab, onTab, counts }) {
  return (
    <nav
      aria-label="Main"
      className="hidden md:flex flex-col shrink-0 h-auto w-full px-3 py-6"
      style={{ background: "rgba(15,12,27,.94)", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
    >
      <div className="px-3 pb-7">
        <p className="display text-2xl leading-none" style={{ fontWeight: 800 }}>SwiftStream</p>
        <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>Sort what you've watched</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {SIDE_TABS.map(t => {
          const on = tab === t.id;
          const count = counts[t.id] || 0;
          return (
            <motion.button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={on ? "page" : undefined}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ color: on ? t.color : "var(--muted)" }}
            >
              {on && (
                <motion.span
                  layoutId="side-pill"
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: "var(--surface)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              )}
              <span className="relative flex items-center justify-center w-7"><t.Icon /></span>
              <span className="relative flex-1 text-sm font-bold">{t.label}</span>
              {count > 0 && t.id !== "discover" && (
                <motion.span
                  key={count}
                  className="relative min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ background: t.color, color: "var(--bg)" }}
                  initial={{ scale: 1.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 16 }}
                >
                  {count}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Signed-in header: account + Sign Out (top right) ---------- */

// Listens to the active Supabase session. Play-First rule: a guest has no stored session, so this never creates a
// client or makes a request for them. It only attaches for a returning user, or when another tab writes a session
// (e.g. the magic link is opened in a new tab).
function useSupabaseSession() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let alive = true;
    let subscription = null;
    const attach = () => {
      if (subscription || !hasStoredSession()) return;
      const supabase = getSupabase();
      supabase.auth.getSession().then(({ data }) => { if (alive) setSession(data.session); });
      const { data } = supabase.auth.onAuthStateChange((_event, next) => { if (alive) setSession(next); });
      subscription = data.subscription;
    };
    attach();
    const onStorage = (e) => { if (e.key === AUTH_STORAGE_KEY || e.key === null) attach(); };
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      if (subscription) subscription.unsubscribe();
    };
  }, []);
  return { session, clear: () => setSession(null) };
}

// `user` is the app's own account state (also covers local demo-mode accounts); `onSignedOut` resets app state.
export function AuthBar({ user, onSignedOut }) {
  const { session, clear } = useSupabaseSession();
  const email = (session && session.user && session.user.email) || (user && user.email);
  if (!email) return null;

  const signOut = async () => {
    if (isSupabaseConfigured && hasStoredSession()) {
      try { await getSupabase().auth.signOut(); } catch { /* ignore: local state is reset below anyway */ }
    }
    clear();                       // hide the bar right away (the SIGNED_OUT event would do the same)
    if (onSignedOut) onSignedOut();
  };

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-3 px-5 py-2 md:px-10"
      style={{ background: "rgba(15,12,27,.7)", borderBottom: "1px solid rgba(255,255,255,.07)" }}
    >
      <p className="text-xs truncate min-w-0" style={{ color: "var(--muted)" }}>
        Signed in as <span className="font-bold" style={{ color: "var(--text)" }}>{email}</span>
      </p>
      <motion.button
        onClick={signOut}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.94 }}
        className="shrink-0 rounded-full px-4 py-1.5 text-sm font-bold"
        style={{ background: "var(--surface-2)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }}
      >
        Sign Out
      </motion.button>
    </div>
  );
}