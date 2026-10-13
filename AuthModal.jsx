// AuthModal.jsx - Passwordless account modal: Google OAuth + email magic link (signInWithOtp). No password field.
// Opened at the guest limit (11th swipe) or from the guest banner. Nothing here runs, and no Supabase client is
// created, until a button is pressed.
// Requires /public/google.png (served as /google.png) for the Google button icon.
import { useState } from "react";
import { motion } from "framer-motion";
import { Sheet } from "./ui";
import { getSupabase, isSupabaseConfigured } from "./supabase";

// High-contrast teal -> purple (white text is >= 5:1 on both ends)
const CTA_GRADIENT = "linear-gradient(120deg, #0b7a73 0%, #6d28d9 100%)";
const CTA_SHADOW = "0 12px 30px -10px rgba(109,40,217,.75), 0 0 0 1.5px rgba(255,255,255,.18)";

export function AuthModal({ reason, swipes, onClose, onDemoAuth, onMagicLinkSent }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(null);     // "google" | "email" | null
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");   // set once the magic link has been emailed
  const demo = !isSupabaseConfigured;
  const gate = reason === "gate";

  const continueWithGoogle = async () => {
    if (busy) return;
    setError("");
    if (demo) {
      setError("Google sign-in needs your Supabase keys in .env. In demo mode, use the email option.");
      return;
    }
    setBusy("google");
    const supabase = getSupabase();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    // On success the browser leaves for Google. The guest's swipes are already in localStorage and are
    // migrated into user_libraries as soon as the app loads again with a session.
    if (err) { setBusy(null); setError(err.message); }
  };

  const sendMagicLink = async () => {
    if (busy) return;
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setError("Enter a valid email address."); return; }
    setBusy("email");
    setError("");
    if (demo) {
      const res = await onDemoAuth(value);
      setBusy(null);
      if (res && res.error) setError(res.error);
      return;
    }
    const supabase = getSupabase();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setBusy(null);
    if (err) { setError(err.message); return; }
    if (onMagicLinkSent) onMagicLinkSent();   // lets the app notice the login if the link is opened in another tab
    setSentTo(value);
  };

  const onEnter = (e) => { if (e.key === "Enter") { e.preventDefault(); sendMagicLink(); } };

  return (
    <Sheet
      title={gate ? "Great start!" : "Create your free account"}
      subtitle={gate ? "Create a free account to save your library and keep swiping." : "Save your library and watchlist, and keep every rating."}
      onClose={onClose}
    >
      {sentTo ? (
        <div className="px-5 pb-6 space-y-4 text-center">
          <p className="display text-2xl" style={{ fontWeight: 800 }}>Check your email</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            We sent a magic link to <span className="font-bold" style={{ color: "var(--text)" }}>{sentTo}</span>.
            Open it and you're in. Your swipes so far are kept on this device and will be saved to your account.
          </p>
          <button
            onClick={() => { setSentTo(""); setError(""); }}
            className="text-sm font-medium underline"
            style={{ color: "var(--muted)" }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div className="px-5 pb-6 space-y-4">
          {gate && (
            <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(255,138,61,.12)", color: "#ffb27a" }}>
              🔥 You've sorted {swipes} shows as a guest.
            </p>
          )}

          {/* Full-width Google button */}
          <motion.button
            onClick={continueWithGoogle}
            disabled={busy !== null}
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: busy ? 1 : 0.97 }}
            className="w-full flex items-center justify-center gap-3 rounded-full py-3.5 text-base font-bold"
            style={{ background: "#ffffff", color: "#1f1f1f", boxShadow: "0 8px 24px -10px rgba(0,0,0,.6)", opacity: busy && busy !== "google" ? 0.6 : 1 }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
  <path
    fill="#4285F4"
    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
  />
  <path
    fill="#34A853"
    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
  />
  <path
    fill="#FBBC05"
    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
  />
  <path
    fill="#EA4335"
    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
  />
</svg>
            {busy === "google" ? "Opening Google..." : "Continue with Google"}
          </motion.button>

          <div className="flex items-center gap-3" role="separator" aria-label="or">
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,.14)" }} />
            <span className="text-xs font-bold" style={{ color: "var(--muted)" }}>OR</span>
            <span className="h-px flex-1" style={{ background: "rgba(255,255,255,.14)" }} />
          </div>

          {/* Passwordless email magic link */}
          <div>
            <label htmlFor="auth-email" className="text-xs font-medium" style={{ color: "var(--muted)" }}>Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              disabled={busy !== null}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={onEnter}
              placeholder="you@example.com"
              className="w-full mt-1 rounded-2xl px-4 py-3 text-sm font-medium bg-transparent focus:outline-none focus:ring-2 focus:ring-white/60"
              style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", color: "var(--text)", userSelect: "text" }}
            />
          </div>

          {error && <p role="alert" className="text-sm font-bold" style={{ color: "var(--skip)" }}>{error}</p>}

          <motion.button
            onClick={sendMagicLink}
            disabled={busy !== null}
            whileHover={{ scale: busy ? 1 : 1.02 }}
            whileTap={{ scale: busy ? 1 : 0.96 }}
            className="w-full rounded-full py-3.5 display text-lg"
            style={{ background: CTA_GRADIENT, color: "#ffffff", boxShadow: CTA_SHADOW, fontWeight: 800, textShadow: "0 1px 2px rgba(0,0,0,.35)", opacity: busy ? 0.6 : 1 }}
          >
            {busy === "email" ? "Sending..." : "Email me a magic link"}
          </motion.button>

          <div className="text-center">
            <button onClick={onClose} className="text-sm font-medium underline" style={{ color: "var(--muted)" }}>Not now</button>
          </div>
          <p className="text-[11px] text-center" style={{ color: "var(--muted)" }}>
            {demo
              ? "Demo mode: add your Supabase keys to .env for real Google and magic-link sign-in. Nothing you type is sent anywhere."
              : "No password needed. Your account is only created now; until this point nothing about your swipes was stored on our servers."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

export default AuthModal;