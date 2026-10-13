// App.jsx - Root component: global state, splash gate, Play-First guest mode + Supabase sync, tabs, modals.
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { PROVIDERS, ALL_SHOWS, GUEST_LIMIT } from "./data";
import { showKey, shuffle, dedupeByShow } from "./utils";
import { ToastCtx, Toast } from "./ui";
import * as api from "./api";
import { loadGuest, saveGuest, clearGuest } from "./guestStore";
import { BottomNav, SideNav, AuthBar } from "./Nav";
import SplashScreen from "./SplashScreen";
import DiscoverDeck, { ProviderSidebar } from "./DiscoverDeck";
import Library from "./Library";
import MatchModal from "./MatchModal";
import InviteModal from "./InviteModal";
import AuthModal from "./AuthModal";

function normalizeLogs(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entries]) => Array.isArray(entries))
      .map(([id, entries]) => [
        id,
        entries.filter(entry => entry && typeof entry === "object" && entry.show && typeof entry.show === "object"),
      ])
  );
}

function deriveItems(logsObj = {}) {
  const entries = Object.entries(logsObj)
    .flatMap(([id, list]) => (Array.isArray(list) ? list : [])
      .filter(e => e && e.show && typeof e.show === "object")
      .map(e => ({ ...e.show, providerId: e.show.providerId || id, action: e.action, t: e.t })))
    .sort((a, b) => b.t - a.t);
  return {
    seen: dedupeByShow(entries.filter(e => e.action === "seen")),
    saved: dedupeByShow(entries.filter(e => e.action === "save")),
  };
}

// Read ?room= once and immediately scrub URL bar so mobile Safari never caches or reloads into MatchModal
function consumeInitialRoomCode() {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(window.location.href);
    const roomParam = (url.searchParams.get("room") || "").replace(/\D/g, "").slice(0, 6);
    if (url.searchParams.has("match") || url.searchParams.has("room")) {
      url.searchParams.delete("match");
      url.searchParams.delete("room");
      const cleanUrl = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
      window.history.replaceState({}, document.title, cleanUrl);
    }
    return roomParam.length >= 4 ? roomParam : "";
  } catch {
    return "";
  }
}

export default function App() {
  const [showLogoFade, setShowLogoFade] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowLogoFade(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const [guest0] = useState(() => {
    const saved = loadGuest() || {};
    const savedSwipes = Number(saved.swipes);
    const savedLock = Number(saved.lockedUntil);
    return {
      logs: normalizeLogs(saved.logs),
      swipes: Number.isFinite(savedSwipes) && savedSwipes > 0 ? Math.floor(savedSwipes) : 0,
      lockedUntil: Number.isFinite(savedLock) && savedLock > 0 ? savedLock : null,
    };
  });

  const [tab, setTab] = useState("discover");
  const [pid, setPid] = useState(null);
  const [logs, setLogs] = useState(guest0.logs || {});
  const [swipes, setSwipes] = useState(guest0.swipes || 0);
  const [lockedUntil, setLockedUntil] = useState(guest0.lockedUntil || null);
  const [mixedShows, setMixedShows] = useState([]);
  const [initialDeckShow, setInitialDeckShow] = useState(null);
  const [authReason, setAuthReason] = useState("gate");
  const [urlMatchCode, setUrlMatchCode] = useState(consumeInitialRoomCode);
  const [modal, setModal] = useState(() => (urlMatchCode ? "match" : null));
  const [matches, setMatches] = useState([]);
  const [invite, setInvite] = useState({ sent: false, joined: false });

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, name) => setToast({ id: Date.now(), message, name }), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const [session, setSession] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [catalogTick, setCatalogTick] = useState(0);
  useEffect(() => {
    api.syncRollingCatalog().then(changed => { if (changed) setCatalogTick(n => n + 1); });
  }, []);
  const syncedRef = useRef(new Map());
  const guestClearedRef = useRef(false);
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const user = useMemo(() => api.toAppUser(session), [session]);
  const uid = session && !session.mock ? session.user?.id ?? null : null;
  const locked = !user && (swipes >= GUEST_LIMIT || lockedUntil !== null);

  const resetToGuest = useCallback(() => {
    setSession(null);
    setHydrated(false);
    setLogs({});
    setSwipes(0);
    setMixedShows([]);
    setInitialDeckShow(null);
    setMatches([]);
    setPid(null);
    syncedRef.current = new Map();
    guestClearedRef.current = false;
    clearGuest();
  }, []);

  const handleExternalAuth = useCallback((s) => {
    if (s) setSession(s);
    else if (sessionRef.current && !sessionRef.current.mock) resetToGuest();
  }, [resetToGuest]);

  useEffect(() => {
    let alive = true;
    api.restoreSession()
      .then(s => {
        if (!alive || !s) return;
        setSession(s);
        if (!s.mock) api.watchAuth(handleExternalAuth);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [handleExternalAuth]);

  useEffect(() => {
    if (uid) return;
    saveGuest(logs, swipes, lockedUntil);
  }, [logs, swipes, lockedUntil, uid]);

  useEffect(() => {
    if (uid) return;
    if (swipes >= GUEST_LIMIT && !lockedUntil) {
      setLockedUntil(Date.now() + 6 * 60 * 60 * 1000);
    }
    if (lockedUntil && Date.now() >= lockedUntil) {
      setSwipes(0);
      setLockedUntil(null);
    }
  }, [swipes, lockedUntil, uid]);

  const handleDemoAuth = async (email) => {
    const res = await api.signIn({ email, password: "" });
    if (res.session) {
      setSession(res.session);
      setModal(null);
      showToast("Signed in (demo mode).", null);
    }
    return res;
  };

  const handleMagicLinkSent = useCallback(() => { api.watchAuth(handleExternalAuth); }, [handleExternalAuth]);

  useEffect(() => {
    if (session && modal === "auth") setModal(null);
  }, [session, modal]);

  const handleSignOut = async () => {
    try { await api.signOutUser(); } catch { /* ignore */ }
    resetToGuest();
    showToast("Signed out.", null);
  };

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        await api.ensureProfile(sessionRef.current.user);
        const rows = await api.fetchLibrary(uid);
        if (cancelled) return;
        const dbLogs = api.rowsToLogs(rows);
        const synced = new Map(rows.map(r => [api.rowKey(r), r.rating ?? null]));

        const { seen, saved } = deriveItems(api.mergeLogs(dbLogs, logsRef.current));
        const toInsert = [...api.itemsToRows(seen, saved)]
          .filter(([k, r]) => !synced.has(k) || synced.get(k) !== r.rating)
          .map(([, r]) => r);
        if (toInsert.length) {
          const res = await api.pushLibrary(uid, toInsert, []);
          if (cancelled) return;
          if (res.error) {
            showToast("Couldn't save your guest swipes yet. Retrying...", null);
            setTimeout(() => setRetryTick(n => n + 1), 4000);
          } else {
            toInsert.forEach(r => synced.set(api.rowKey(r), r.rating));
            guestClearedRef.current = true;
            clearGuest();
            showToast(`Saved ${toInsert.length} ${toInsert.length === 1 ? "show" : "shows"} from your guest session to your account.`, null);
          }
        }

        syncedRef.current = synced;
        setLogs(prev => api.mergeLogs(dbLogs, prev));
        setHydrated(true);
      } catch {
        if (!cancelled) showToast("Couldn't load your library. Check your connection and reload.", null);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, showToast]);

  const setLog = useCallback((id, updater) => {
    setLogs(prev => {
      const cur = prev[id] || [];
      const updated = typeof updater === "function" ? updater(cur) : updater;
      const next = { ...prev, [id]: updated };

      if (id === "mixed") {
        if (updated.length > cur.length) {
          const added = updated[updated.length - 1];
          const pId = added?.show?.providerId;
          if (pId && pId !== "mixed") {
            const pLog = next[pId] || [];
            if (!pLog.some(e => e.show.id === added.show.id)) {
              next[pId] = [...pLog, added];
            }
          }
        } else if (updated.length < cur.length) {
          const removed = cur[cur.length - 1];
          const pId = removed?.show?.providerId;
          if (pId && pId !== "mixed" && next[pId]) {
            next[pId] = next[pId].filter(e => !(e.show.id === removed.show.id && e.t === removed.t));
          }
        }
      }
      return next;
    });
  }, []);

  const rateShow = useCallback((providerId, showId, rating) => {
    setLogs(prev => {
      const next = {};
      Object.entries(prev).forEach(([k, l]) => {
        next[k] = l.map(e => (e.action === "seen" && e.show.id === showId && (e.show.providerId || k) === providerId ? { ...e, rating } : e));
      });
      return next;
    });
  }, []);

  const moveToSeen = useCallback((item) => {
    const provId = item.providerId;
    setLogs(prev => {
      const next = {};
      let found = false;
      Object.entries(prev).forEach(([k, l]) => {
        next[k] = l.map(e => {
          if (e.show.id === item.id && (e.show.providerId || k) === provId) {
            found = true;
            return { ...e, action: "seen", t: Date.now() };
          }
          return e;
        });
      });
      if (!found) {
        next[provId] = [...(next[provId] || []), { show: item, action: "seen", t: Date.now() }];
      }
      return next;
    });
    setMatches(prev => prev.filter(m => showKey(m) !== showKey(item)));
    showToast(`Moved "${item.title}" to your Seen Library!`, null);
  }, [showToast]);

  const removeFromCollection = useCallback((item) => {
    const provId = item.providerId;
    setLogs(prev => {
      const next = {};
      Object.entries(prev).forEach(([k, l]) => {
        next[k] = l.filter(e => !(e.show.id === item.id && (e.show.providerId || k) === provId));
      });
      return next;
    });
    setMatches(prev => prev.filter(m => showKey(m) !== showKey(item)));
    showToast(`Removed "${item.title}".`, null);
  }, [showToast]);

  const { seen: seenItems, saved: savedItems } = useMemo(() => deriveItems(logs), [logs]);

  useEffect(() => {
    if (uid) {
      try { window.localStorage.setItem(`swiftstream-auth-${uid}`, JSON.stringify(logs)); } catch { /* ignore */ }
    }
  }, [logs, uid]);

  useEffect(() => {
    if (!uid || !hydrated) return;
    const desired = api.itemsToRows(seenItems, savedItems);
    
    const trySync = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      
      const synced = syncedRef.current;
      const upserts = [];
      const deletes = [];
      desired.forEach((row, k) => { if (!synced.has(k) || synced.get(k) !== row.rating) upserts.push(row); });
      synced.forEach((_, k) => {
        if (!desired.has(k)) { const [provider_id, show_id, status] = k.split(":"); deletes.push({ provider_id, show_id: Number(show_id), status }); }
      });
      
      if (upserts.length || deletes.length) {
        const res = await api.pushLibrary(uid, upserts, deletes);
        if (res.error) {
          setTimeout(() => setRetryTick(n => n + 1), 5000);
          return;
        }
        upserts.forEach(r => synced.set(api.rowKey(r), r.rating));
        deletes.forEach(d => synced.delete(`${d.provider_id}:${d.show_id}:${d.status}`));
      }
      if (!guestClearedRef.current) { clearGuest(); guestClearedRef.current = true; }
    };

    const timer = setTimeout(trySync, 700);
    return () => clearTimeout(timer);
  }, [logs, hydrated, uid, retryTick]);

  useEffect(() => {
    const onOnline = () => setRetryTick(n => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setUrlMatchCode("");
  }, []);
  const openAuth = useCallback((reason) => { setAuthReason(reason); setModal("auth"); }, []);
  const openGate = useCallback(() => openAuth("gate"), [openAuth]);
  const countSwipe = useCallback(() => setSwipes(n => n + 1), []);
  const addMatches = useCallback((ms) => {
    setMatches(prev => {
      const map = new Map(prev.map(m => [showKey(m), m]));
      ms.forEach(m => { if (!map.has(showKey(m))) map.set(showKey(m), { ...m, t: Date.now() }); });
      return [...map.values()];
    });
  }, []);

  const watchItems = useMemo(() => {
    const map = new Map();
    savedItems.forEach(i => map.set(showKey(i), { ...i }));
    matches.forEach(m => map.set(showKey(m), { ...(map.get(showKey(m)) || {}), ...m, shared: true }));
    return [...map.values()].sort((a, b) => (b.shared ? 1 : 0) - (a.shared ? 1 : 0) || b.t - a.t);
  }, [savedItems, matches]);

  const mixedProvider = useMemo(() => ({ id: "mixed", name: "Mixed Mode", accent: "#ff5ccf", shows: ALL_SHOWS }), []);
  const provider = useMemo(() => {
    if (pid === "mixed") return mixedProvider;
    return PROVIDERS.find(x => x.id === pid) || null;
  }, [pid, mixedProvider, catalogTick]);

  const allSortedEntries = useMemo(() => {
    const map = new Map();
    Object.entries(logs).forEach(([k, arr]) => {
      if (k === "mixed") return;
      (arr || []).forEach(e => {
        const key = showKey({ ...e.show, providerId: e.show.providerId || k });
        map.set(key, { ...e, show: { ...e.show, providerId: e.show.providerId || k } });
      });
    });
    logs.mixed?.forEach(e => {
      const key = showKey(e.show);
      if (!map.has(key)) map.set(key, e);
    });
    return [...map.values()];
  }, [logs]);

  const pickProvider = (id) => {
    setInitialDeckShow(null);
    setPid(id);
  };
  const pickTrendingShow = (show) => {
    setTab("discover");
    setPid("mixed");
    setInitialDeckShow(show);
  };

  const sortedCounts = useMemo(() => {
    const c = Object.fromEntries(Object.entries(logs || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
    c.mixed = allSortedEntries.length;
    return c;
  }, [logs, allSortedEntries]);
  const navCounts = { watchlist: watchItems.length, library: seenItems.length };

  return (
    <MotionConfig reducedMotion="user">
      <ToastCtx.Provider value={showToast}>
        <AnimatePresence>
          {showLogoFade && (
            <motion.div
              key="logo-fade"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[#080610]"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.05, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center space-x-3"
              >
                <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-2xl font-extrabold tracking-wider text-white">
                  SwiftStream
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="ambient" />

        <div className="relative z-10 flex flex-col md:flex-row min-h-screen md:h-screen bg-[#080610] text-slate-100 overflow-x-hidden">
            
            {/* Desktop navigation and provider dashboard */}
            <aside
              className="hidden md:flex w-full md:w-96 flex-shrink-0 flex-col bg-[#0b0816] md:sticky md:top-0 md:h-screen md:overflow-y-auto"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <SideNav 
                tab={tab} 
                onTab={setTab} 
                counts={{ ...sortedCounts, ...navCounts }}
              />
              <ProviderSidebar
                onPick={pickProvider}
                activeId={pid}
                counts={sortedCounts}
              />
            </aside>

            {/* Main Content Viewport */}
            <main
              className="flex h-full w-full min-w-0 flex-1 flex-col justify-between overflow-y-auto bg-[#080610] p-2 pb-[calc(6rem+env(safe-area-inset-bottom))] md:h-screen md:min-h-0 md:p-4"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex h-full min-h-0 w-full flex-1 flex-col">
              <div className={tab === "discover" ? "hidden" : "block"}>
                <AuthBar
                  user={user}
                  onSignedOut={handleSignOut}
                  onSignIn={() => openAuth("banner")}
                />
              </div>

              <div className="flex w-full min-w-0 flex-1 flex-col">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    className="flex h-full w-full min-w-0 flex-col"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tab === "discover" && (
                      <div className="flex w-full min-w-0 flex-1 flex-col">
                        <DiscoverDeck
                          provider={provider}
                          pid={pid}
                          logs={logs}
                          onLog={setLog}
                          onPick={pickProvider}
                          onPickShow={pickTrendingShow}
                          onHome={() => { setInitialDeckShow(null); setPid(null); }}
                          initialShow={initialDeckShow}
                          onInitialShowConsumed={() => setInitialDeckShow(null)}
                          counts={sortedCounts}
                          locked={locked}
                          onGate={openGate}
                          onSwipe={countSwipe}
                          swipes={swipes}
                          user={user}
                          onSignOut={handleSignOut}
                          onOpenAuth={() => openAuth("banner")}
                          onOpenMatch={() => setModal("match")}
                          onOpenInvite={() => setModal("invite")}
                        />
                      </div>
                    )}
                    {tab === "watchlist" && (
                      <Library
                        kind="watchlist"
                        items={watchItems}
                        onDiscover={() => setTab("discover")}
                        onMoveToSeen={moveToSeen}
                        onRemove={removeFromCollection}
                        onOpenMatch={() => setModal("match")}
                        guest={!user}
                        onAuth={() => openAuth("banner")}
                      />
                    )}
                    {tab === "library" && (
                      <Library
                        kind="library"
                        items={seenItems}
                        onDiscover={() => setTab("discover")}
                        onRemove={removeFromCollection}
                        guest={!user}
                        onAuth={() => openAuth("banner")}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <div className="md:hidden">
                <BottomNav tab={tab} onTab={setTab} counts={navCounts} />
              </div>
              </div>
            </main>

        </div>

        <AnimatePresence>
          {modal === "match" && (
            <MatchModal
              key="match"
              initialCode={urlMatchCode}
              onClearCode={() => setUrlMatchCode("")}
              onClose={closeModal}
              onMatches={addMatches}
            />
          )}
          {modal === "auth" && (
            <AuthModal key="auth" reason={authReason} swipes={swipes} onClose={closeModal} onDemoAuth={handleDemoAuth} onMagicLinkSent={handleMagicLinkSent} />
          )}
          {modal === "invite" && <InviteModal key="invite" onClose={closeModal} invite={invite} onInvite={(patch) => setInvite(v => ({ ...v, ...patch }))} />}
        </AnimatePresence>

        <Toast toast={toast} />
      </ToastCtx.Provider>
    </MotionConfig>
  );
}