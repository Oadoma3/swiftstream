// api.js - Auth + library persistence. Every Supabase call in the app lives in this file.
import { getSupabase, isSupabaseConfigured, hasStoredSession, urlHasAuthParams } from "./supabase";
import { PROVIDERS, findShow, applyRemoteCatalog } from "./data";

/* ---------------------------------------------------------------- auth */

const DEMO_KEY = "swiftstream-demo-user";   // used only when no Supabase keys are configured

function demoSession(email, name) {
  const session = { mock: true, user: { id: "demo-" + email, email, user_metadata: { display_name: name } } };
  try { window.localStorage.setItem(DEMO_KEY, JSON.stringify(session)); } catch { /* ignore */ }
  return { session };
}
function readDemo() {
  try { const raw = window.localStorage.getItem(DEMO_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function toAppUser(session) {
  if (!session || !session.user) return null;
  const u = session.user;
  const email = u.email || "";
  return {
    id: u.id,
    email,
    name: (u.user_metadata && u.user_metadata.display_name) || email.split("@")[0] || "You",
  };
}

export async function signUp({ email, password, name }) {
  const displayName = (name || "").trim() || email.split("@")[0];
  const sb = getSupabase();
  if (!sb) return demoSession(email, displayName);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { error: error.message };
  // With "Confirm email" on, an already-registered address comes back with no identities and no error.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "An account with that email already exists. Try logging in instead." };
  }
  if (!data.session) return { confirm: true };   // email confirmation required before first login
  return { session: data.session };
}

export async function signIn({ email, password }) {
  const sb = getSupabase();
  if (!sb) return demoSession(email, email.split("@")[0]);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { session: data.session };
}

// Returns an existing session, or null. Never touches Supabase for a brand-new guest.
export async function restoreSession() {
  const demo = readDemo();
  if (demo) return demo;
  if (!isSupabaseConfigured) return null;
  if (!hasStoredSession() && !urlHasAuthParams()) return null;
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  return data.session;
}

let unsubscribe = null;
// Subscribes once to auth changes (token refresh, sign-out in another tab, ...).
export function watchAuth(callback) {
  const sb = getSupabase();
  if (!sb || unsubscribe) return;
  const { data } = sb.auth.onAuthStateChange((_event, session) => callback(session));
  unsubscribe = () => data.subscription.unsubscribe();
}

export async function signOutUser() {
  try { window.localStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (isSupabaseConfigured && hasStoredSession()) {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
  }
}

/* ------------------------------------------------------------- library */

// Row <-> app mapping. The app's "save" action is stored as status 'saved'.
export const rowKey = (r) => `${r.provider_id}:${r.show_id}:${r.status}`;

// seen/saved items (deduped, newest wins) -> Map of rows we want to exist in the database
export function itemsToRows(seenItems, savedItems) {
  const rows = new Map();
  seenItems.forEach(i => {
    const r = { provider_id: i.providerId, show_id: i.id, show_title: i.title, status: "seen", rating: i.rating || "seen" };
    rows.set(rowKey(r), r);
  });
  savedItems.forEach(i => {
    const r = { provider_id: i.providerId, show_id: i.id, show_title: i.title, status: "saved", rating: null };
    rows.set(rowKey(r), r);
  });
  return rows;
}

// Database rows -> the app's per-provider logs.
// A show that is both seen AND saved keeps its first entry under its provider and the second under "mixed",
// so no provider deck ever contains the same show twice.
export function rowsToLogs(rows) {
  const logs = {};
  const placed = new Set();
  rows.forEach(r => {
    const show = findShow(r.provider_id, r.show_id);
    if (!show) return;                                   // show no longer in the catalog
    const entry = { show, action: r.status === "seen" ? "seen" : "save", rating: r.status === "seen" ? r.rating : undefined, t: Date.parse(r.created_at) || Date.now() };
    const key = placed.has(`${r.provider_id}:${r.show_id}`) ? "mixed" : r.provider_id;
    placed.add(`${r.provider_id}:${r.show_id}`);
    (logs[key] = logs[key] || []).push(entry);
  });
  return logs;
}

// Account data wins; guest swipes are added for shows the account has not touched.
export function mergeLogs(dbLogs, guestLogs) {
  const out = {};
  const sig = (e, k) => `${e.show.providerId || k}:${e.show.id}`;
  new Set([...Object.keys(dbLogs), ...Object.keys(guestLogs)]).forEach(k => {
    const base = dbLogs[k] || [];
    const taken = new Set(base.map(e => sig(e, k)));
    out[k] = [...base, ...(guestLogs[k] || []).filter(e => !taken.has(sig(e, k)))];
  });
  return out;
}

export async function ensureProfile(user) {
  const sb = getSupabase();
  if (!sb) return;
  // The sign-up trigger normally created this already; this is a harmless safety net.
  await sb.from("users").upsert(
    { id: user.id, email: user.email, display_name: (user.user_metadata && user.user_metadata.display_name) || null },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

export async function fetchLibrary(userId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("user_libraries")
    .select("provider_id, show_id, status, rating, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// One upsert request for everything new/changed, plus one delete request per (provider, status) group.
export async function pushLibrary(userId, upserts, deletes) {
  const sb = getSupabase();
  if (upserts.length) {
    const { error } = await sb
      .from("user_libraries")
      .upsert(upserts.map(r => ({ ...r, user_id: userId })), { onConflict: "user_id,provider_id,show_id,status" });
    if (error) return { error };
  }
  const groups = new Map();
  deletes.forEach(d => {
    const k = `${d.provider_id}|${d.status}`;
    if (!groups.has(k)) groups.set(k, { provider_id: d.provider_id, status: d.status, ids: [] });
    groups.get(k).ids.push(d.show_id);
  });
  for (const g of groups.values()) {
    const { error } = await sb
      .from("user_libraries")
      .delete()
      .eq("user_id", userId)
      .eq("provider_id", g.provider_id)
      .eq("status", g.status)
      .in("show_id", g.ids);
    if (error) return { error };
  }
  return {};
}
/* ------------------------------------------------------------- rolling catalog */
export async function syncRollingCatalog() {
  if (!isSupabaseConfigured) return false;
  const sb = getSupabase();
  if (!sb) return false;
  try {
    const { data, error } = await sb
      .from("catalog_shows")
      .select("*")
      .limit(500);
    if (error || !data || data.length === 0) return false;
    return applyRemoteCatalog(data);
  } catch {
    return false;
  }
}