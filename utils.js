// utils.js - Small pure helpers shared across the app.

/* ---------- Poster face (placeholder art) ---------- */
export function initials(title) {
  const words = title.replace(/[^A-Za-z0-9' ]/g, "").split(" ").filter(w => !["a","the","of"].includes(w.toLowerCase()));
  return words.slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/* Pick readable text (dark or white) for a brand-colored button */
export function readableText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#0b0c0f" : "#ffffff";
}
export const showKey = (s) => s.providerId + ":" + s.id;
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}   // free swipes before the account prompt

export function dedupeByShow(list) {
  const seen = new Set();
  return list.filter(i => { const k = showKey(i); if (seen.has(k)) return false; seen.add(k); return true; });
}
export const RATINGS = {
  seen: { label: "Seen", emoji: "\u2713", color: "var(--seen)" },
  love: { label: "Love", emoji: "\u2764\uFE0F", color: "#ff5c8a" },
  like: { label: "Like", emoji: "\uD83D\uDC4D", color: "var(--seen)" },
  meh: { label: "Meh", emoji: "\uD83D\uDE10", color: "#f5c842" },
};

export const RATING_CHOICES = ["seen", "love", "like", "meh"];
