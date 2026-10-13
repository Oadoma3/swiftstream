// guestStore.js - Keeps a guest's swipes in localStorage ONLY (never sent anywhere).
// This means a refresh does not reset the 10-swipe limit, and an email-confirmation
// round trip does not lose the guest's progress. It is merged into Supabase after sign-up.
import { findShow } from "./data";

const KEY = "swiftstream-guest-v1";

export function loadGuest() {
  const empty = { logs: {}, swipes: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const logs = {};
    Object.entries(data.logs || {}).forEach(([k, list]) => {
      logs[k] = list
        .map(e => {
          const show = findShow(e.p || k, e.i);
          return show ? { show, action: e.a, rating: e.r, t: e.t } : null;
        })
        .filter(Boolean);
    });
    return { logs, swipes: Number(data.swipes) || 0 };
  } catch {
    return empty;
  }
}

export function saveGuest(logs, swipes) {
  try {
    const slim = {};
    Object.entries(logs).forEach(([k, list]) => {
      slim[k] = list.map(e => ({ p: e.show.providerId || k, i: e.show.id, a: e.action, r: e.rating, t: e.t }));
    });
    window.localStorage.setItem(KEY, JSON.stringify({ logs: slim, swipes }));
  } catch {
    /* storage unavailable: guest progress just won't survive a refresh */
  }
}

export function clearGuest() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}