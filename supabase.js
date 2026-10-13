// supabase.js - Lazy Supabase client.
//
// PLAY-FIRST RULE: importing this file does NOT create a client, open a connection, or make any request.
// The client is only created by getSupabase(), and the app only calls that
//   (a) when a returning user already has a stored session, or
//   (b) when a guest submits the sign-up / log-in form after their free swipes.
// A brand-new guest therefore costs you zero auth calls and zero database rows.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Fixed storage key so we can tell "has a saved session?" without creating a client.
export const AUTH_STORAGE_KEY = "swiftstream-auth";

let client = null;

export function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // needed for the email-confirmation link
      },
    });
  }
  return client;
}

// True only if a previous visit left a session behind (reads localStorage, no network).
export function hasStoredSession() {
  try {
    return Boolean(window.localStorage.getItem(AUTH_STORAGE_KEY));
  } catch {
    return false;
  }
}

// True when the page was opened from a Supabase email link (confirm signup, etc.).
export function urlHasAuthParams() {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  const query = window.location.search || "";
  return (
    /access_token=|refresh_token=|error_description=|type=(signup|recovery|magiclink|invite)/.test(hash) ||
    /[?&]code=/.test(query)
  );
}