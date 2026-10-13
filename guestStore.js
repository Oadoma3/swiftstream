export function loadGuest() {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem("swiftstream-guest-v2") : null;
    if (raw) {
      const data = JSON.parse(raw);
      if (data.lockedUntil && Date.now() >= data.lockedUntil) {
        return { logs: data.logs || {}, swipes: 0, lockedUntil: null };
      }
      return { logs: data.logs || {}, swipes: data.swipes || 0, lockedUntil: data.lockedUntil || null };
    }
  } catch { /* ignore */ }
  return { logs: {}, swipes: 0, lockedUntil: null };
}

export function saveGuest(logs, swipes, lockedUntil = null) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("swiftstream-guest-v2", JSON.stringify({ logs, swipes, lockedUntil }));
    }
  } catch { /* ignore */ }
}

export function clearGuest() {
  try { if (typeof window !== "undefined") window.localStorage.removeItem("swiftstream-guest-v2"); } catch { /* ignore */ }
}