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
import DiscoverDeck from "./DiscoverDeck";
import Library from "./Library";
import MatchModal from "./MatchModal";
import InviteModal from "./InviteModal";
import AuthModal from "./AuthModal";

function deriveItems(logsObj) {
  const entries = Object.entries(logsObj)
    .flatMap(([id, l]) => l.map(e => ({ ...e.show, providerId: e.show.providerId || id, action: e.action, rating: e.rating, t: e.t })))
    .sort((a, b) => b.t - a.t);
  return {
    seen: dedupeByShow(entries.filter(e => e.action === "seen")),
    saved: dedupeByShow(entries.filter(e => e.action === "save")),
  };
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [guest0] = useState(loadGuest);

  const [tab, setTab] = useState("discover");
  const [pid, setPid] = useState(null);
  const [logs, setLogs] = useState(guest0.logs);
  const [swipes, setSwipes] = useState(guest0.swipes);
  const [mixedShows, setMixedShows] = useState([]);
  const [authReason, setAuthReason] = useState("gate");
  const [urlMatchCode] = useState(() => new URLSearchParams(window.location.search).get("match") || "");
  const [modal, setModal] = useState(() => new URLSearchParams(window.location.search).get("match") ? "match" : null);
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
  const [retryTick, setRetryTick] = useState(0); const [catalogTick, setCatalogTick] = useState(0); useEffect(() => { api.syncRollingCatalog().then(changed => { if (changed) setCatalogTick(n => n + 1); }); }, []);
  const syncedRef = useRef(new Map());
  const guestClearedRef = useRef(false);
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const user = useMemo(() => api.toAppUser(session), [session]);
  const uid = session && !session.mock ? session.user.id : null;
  const locked = !user && swipes >= GUEST_LIMIT;

  const resetToGuest = useCallback(() => {
    setSession(null);
    setHydrated(false);
    setLogs({});
    setSwipes(0);
    setMixedShows([]);
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
    saveGuest(logs, swipes);
  }, [logs, swipes, uid]);

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
      } catch (e) {
        if (!cancelled) showToast("Couldn't load your library. Check your connection and reload.", null);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, showToast]);

  const setLog = useCallback((id, updater) => {
    setLogs(prev => {
      const cur = prev[id] || [];
      return { ...prev, [id]: typeof updater === "function" ? updater(cur) : updater };
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
            return { ...e, action: "seen", rating: "seen", t: Date.now() };
          }
          return e;
        });
      });
      if (!found) {
        next[provId] = [...(next[provId] || []), { show: item, action: "seen", rating: "seen", t: Date.now() }];
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
    if (!uid || !hydrated) return;
    const desired = api.itemsToRows(seenItems, savedItems);
    const timer = setTimeout(async () => {
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
          showToast("Couldn't save your library. Retrying...", null);
          setTimeout(() => setRetryTick(n => n + 1), 4000);
          return;
        }
        upserts.forEach(r => synced.set(api.rowKey(r), r.rating));
        deletes.forEach(d => synced.delete(`${d.provider_id}:${d.show_id}:${d.status}`));
      }
      if (!guestClearedRef.current) { clearGuest(); guestClearedRef.current = true; }
    }, 700);
    return () => clearTimeout(timer);
  }, [logs, hydrated, uid, retryTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeModal = useCallback(() => setModal(null), []);
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

  const mixedProvider = useMemo(() => ({ id: "mixed", name: "Mixed Mode", accent: "#ff5ccf", shows: mixedShows }), [mixedShows]);
  const provider = useMemo(() => {
    if (pid === "mixed") return mixedProvider;
    const p = PROVIDERS.find(x => x.id === pid);
    if (!p) return undefined;
    const sorted = (logs[p.id] || []).map(e => p.shows.find(s => s.id === e.show.id) || e.show);
    const sortedIds = new Set(sorted.map(s => s.id));
    return { ...p, shows: [...sorted, ...p.shows.filter(s => !sortedIds.has(s.id))] };
  }, [pid, logs, mixedProvider, catalogTick]);

  const pickProvider = (id) => {
    if (id === "mixed") {
      const done = (logs.mixed || []).map(e => e.show);
      const doneKeys = new Set(done.map(showKey));
      setMixedShows([...done, ...shuffle(ALL_SHOWS.filter(x => !doneKeys.has(showKey(x))))]);
    }
    setPid(id);
  };

  const sortedCounts = Object.fromEntries(Object.entries(logs).map(([k, v]) => [k, v.length]));
  const navCounts = { watchlist: watchItems.length, library: seenItems.length };

  return (
    <MotionConfig reducedMotion="user">
      <ToastCtx.Provider value={showToast}>
        <div className="ambient" />

        <AnimatePresence>
          {booting && <SplashScreen key="splash" onDone={() => setBooting(false)} />}
        </AnimatePresence>

        {!booting && (
          <>
            <div className="relative z-10 h-full flex flex-col md:flex-row">
              <SideNav tab={tab} onTab={setTab} counts={navCounts} />
              <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                <AuthBar user={user} onSignedOut={handleSignOut} />
                <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={tab}
                    className="h-full"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tab === "discover" && (
                      <DiscoverDeck
                        provider={provider}
                        pid={pid}
                        logs={logs}
                        onLog={setLog}
                        onPick={pickProvider}
                        onHome={() => setPid(null)}
                        counts={sortedCounts}
                        locked={locked}
                        onGate={openGate}
                        onSwipe={countSwipe}
                        swipes={swipes}
                        user={null}
                        onOpenMatch={() => setModal("match")}
                        onOpenInvite={() => setModal("invite")}
                      />
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
                        onRate={rateShow}
                        onRemove={removeFromCollection}
                        guest={!user}
                        onAuth={() => openAuth("banner")}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
                </div>
              </div>

              <BottomNav tab={tab} onTab={setTab} counts={navCounts} />
            </div>

            <AnimatePresence>
              {modal === "match" && <MatchModal key="match" initialCode={urlMatchCode} onClose={closeModal} onMatches={addMatches} />}
              {modal === "auth" && (
                <AuthModal key="auth" reason={authReason} swipes={swipes} onClose={closeModal} onDemoAuth={handleDemoAuth} onMagicLinkSent={handleMagicLinkSent} />
              )}
              {modal === "invite" && <InviteModal key="invite" onClose={closeModal} invite={invite} onInvite={(patch) => setInvite(v => ({ ...v, ...patch }))} />}
            </AnimatePresence>
          </>
        )}

        <Toast toast={toast} />
      </ToastCtx.Provider>
    </MotionConfig>
  );
}