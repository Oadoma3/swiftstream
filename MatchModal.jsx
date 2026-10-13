import { useState, useEffect, useCallback, useMemo, useRef, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, CopyIcon, ProviderIcon, ShareIcon, Sheet, ToastCtx, XIcon } from "./ui";
import { ALL_SHOWS, PROVIDERS } from "./data";
import { copyText, initials, readableText, showKey } from "./utils";
import { PosterFace, SwipeCard, launchStream } from "./Card";
import { getSupabase } from "./supabase";

const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

function seededShuffle(list, seedStr) {
  const arr = [...list];
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    const j = (h >>> 0) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function WatchNowPill({ show }) {
  const showToast = useContext(ToastCtx);
  const prov = PROVIDERS.find(p => p.name === show.network);
  const brand = prov ? prov.brand : "#ffffff";
  return (
    <motion.button
      onClick={() => launchStream(show, show.network, showToast)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      className="w-full rounded-full font-extrabold py-2 text-sm mt-2.5"
      style={{ background: brand, color: readableText(brand), boxShadow: `0 8px 20px -8px ${brand}, inset 0 0 0 1.5px rgba(255,255,255,.3)` }}
    >
      Watch on {show.network}
    </motion.button>
  );
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
    id: i, x: (Math.random() - 0.5) * 360, y: -(50 + Math.random() * 170), r: (Math.random() - 0.5) * 600,
    c: ["#5ce1c4", "#ffc857", "#ff6b7a", "#8f5bff", "#2bb7ff"][i % 5], s: 6 + Math.random() * 6, d: Math.random() * 0.2,
  })), []);
  return (
    <div className="absolute left-1/2 top-14 pointer-events-none" aria-hidden="true">
      {bits.map(b => (
        <motion.span
          key={b.id}
          className="absolute rounded-sm"
          style={{ width: b.s, height: b.s * 1.6, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.6 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 260], opacity: [1, 1, 0], rotate: b.r, scale: 1 }}
          transition={{ duration: 1.7, delay: b.d, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function Segments({ n, color }) {
  return (
    <div className="flex gap-1.5 mt-1">
      {Array.from({ length: n }, (_, i) => (
        <motion.div key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: color(i) }} transition={{ duration: 0.25 }} />
      ))}
    </div>
  );
}

export function WatchMatchModal({ onClose, onMatches, initialCode = "", onClearCode }) {
  const showToast = useContext(ToastCtx);
  const [clientId] = useState(() => Math.random().toString(36).slice(2, 10));
  const [code, setCode] = useState(() => initialCode || randomCode());
  const [joinInput, setJoinInput] = useState("");
  const [friendConnected, setFriendConnected] = useState(Boolean(initialCode));
  const [simulate, setSimulate] = useState(!initialCode);

  const [step, setStep] = useState("setup");
  const [provId, setProvId] = useState(null);
  const [genre, setGenre] = useState(null);
  const [round, setRound] = useState(1);
  const [deck, setDeck] = useState([]);
  const [votes, setVotes] = useState([]);
  const [friendVotes, setFriendVotes] = useState([]);
  const [friendProgress, setFriendProgress] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState("seen");
  const chanRef = useRef(null);

  const fullLink = `https://swiftstream-seven.vercel.app/?room=${code}`;

  const scope = useMemo(() => ALL_SHOWS.filter(s => !provId || s.providerId === provId), [provId]);
  const genreOptions = useMemo(() => [...new Set(scope.flatMap(s => s.genres))].sort(), [scope]);
  const effGenre = genre && genreOptions.includes(genre) ? genre : null;
  const pool = useMemo(() => scope.filter(s => !effGenre || s.genres.includes(effGenre)), [scope, effGenre]);
  const deckSize = Math.min(5, pool.length);

  const broadcast = useCallback((data) => {
    if (chanRef.current) {
      chanRef.current.send({ type: "broadcast", event: "sync", payload: { sender: clientId, ...data } });
    }
  }, [clientId]);

  const startRoundWith = useCallback((targetProvId, targetGenre, targetRound, isSim) => {
    const subScope = ALL_SHOWS.filter(s => !targetProvId || s.providerId === targetProvId);
    const subPool = subScope.filter(s => !targetGenre || s.genres.includes(targetGenre));
    const size = Math.min(5, subPool.length);
    const seed = `${code}-${targetProvId || "any"}-${targetGenre || "any"}-${targetRound}`;
    const next = seededShuffle(subPool, seed).slice(0, size);
    if (isSim) {
      const fv = next.map(() => Math.random() < 0.6);
      if (!fv.some(Boolean) && next.length) fv[0] = true;
      setFriendVotes(fv);
      setFriendProgress(0);
    } else {
      setFriendVotes([]);
      setFriendProgress(0);
    }
    setDeck(next);
    setVotes([]);
    setFlipped(false);
    setDir("seen");
    setStep("swipe");
  }, [code]);

  // Live Supabase room sync for two phones
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !code) return;
    const ch = sb.channel(`match-room-${code}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "sync" }, ({ payload }) => {
      if (!payload || payload.sender === clientId) return;
      if (payload.type === "join") {
        setFriendConnected(true);
        setSimulate(false);
        showToast(`Friend connected to Room #${code}!`, null);
        ch.send({ type: "broadcast", event: "sync", payload: { sender: clientId, type: "join-ack" } });
      } else if (payload.type === "join-ack") {
        setFriendConnected(true);
        setSimulate(false);
      } else if (payload.type === "filter") {
        setProvId(payload.provId ?? null);
        setGenre(payload.genre ?? null);
      } else if (payload.type === "start") {
        const p = payload.provId ?? null;
        const g = payload.genre ?? null;
        const r = payload.round || 1;
        setFriendConnected(true);
        setSimulate(false);
        setProvId(p);
        setGenre(g);
        setRound(r);
        startRoundWith(p, g, r, false);
      } else if (payload.type === "vote") {
        setFriendConnected(true);
        setSimulate(false);
        setFriendVotes(payload.votes || []);
        setFriendProgress((payload.votes || []).length);
      } else if (payload.type === "disband") {
        setFriendConnected(false);
        setSimulate(true);
        setStep("setup");
        setDeck([]);
        setVotes([]);
        setFriendVotes([]);
        setFriendProgress(0);
        setCode(randomCode());
        if (onClearCode) onClearCode();
        showToast("Room was disbanded by your friend.", null);
      }
    }).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        ch.send({ type: "broadcast", event: "sync", payload: { sender: clientId, type: "join" } });
      }
    });
    chanRef.current = ch;
    return () => { sb.removeChannel(ch); chanRef.current = null; };
  }, [code, clientId, showToast, startRoundWith, onClearCode]);

  // Disconnect / Disband Room action
  const disbandRoom = useCallback((closeAfter = false) => {
    broadcast({ type: "disband" });
    const sb = getSupabase();
    if (sb && chanRef.current) {
      try { sb.removeChannel(chanRef.current); } catch { /* ignore */ }
      chanRef.current = null;
    }
    if (onClearCode) onClearCode();
    setFriendConnected(false);
    setSimulate(true);
    setStep("setup");
    setDeck([]);
    setVotes([]);
    setFriendVotes([]);
    setFriendProgress(0);
    setCode(randomCode());
    showToast("Disconnected from room.", null);
    if (closeAfter && onClose) onClose();
  }, [broadcast, onClearCode, onClose, showToast]);

  const handleJoinCode = (e) => {
    e.preventDefault();
    const cleaned = joinInput.replace(/\D/g, "").slice(0, 6);
    if (cleaned.length < 4) {
      showToast("Enter your friend's 6-digit room code.", null);
      return;
    }
    setCode(cleaned);
    setJoinInput("");
    setFriendConnected(true);
    setSimulate(false);
    showToast(`Joined Room #MATCH-${cleaned}!`, null);
  };

  const begin = (customRound = round) => {
    if (!simulate) {
      broadcast({ type: "start", provId, genre: effGenre, round: customRound });
    }
    startRoundWith(provId, effGenre, customRound, simulate);
  };

  const vote = useCallback((action) => {
    if (step !== "swipe") return;
    setDir(action);
    setFlipped(false);
    setVotes(v => {
      if (v.length >= deck.length) return v;
      const updated = [...v, action !== "skip"];
      broadcast({ type: "vote", votes: updated });
      return updated;
    });
  }, [step, deck.length, broadcast]);

  useEffect(() => {
    if (step === "swipe" && deck.length && votes.length >= deck.length) setStep("wait");
  }, [step, votes.length, deck.length]);

  useEffect(() => {
    if (!simulate || (step !== "swipe" && step !== "wait") || friendProgress >= deck.length) return;
    const id = setTimeout(() => setFriendProgress(p => Math.min(deck.length, p + 1)), 900 + Math.random() * 500);
    return () => clearTimeout(id);
  }, [simulate, step, friendProgress, deck.length]);

  useEffect(() => {
    if (step !== "wait" || friendProgress < deck.length) return;
    const id = setTimeout(() => setStep("result"), 600);
    return () => clearTimeout(id);
  }, [step, friendProgress, deck.length]);

  const matched = useMemo(() => deck.filter((s, i) => votes[i] && friendVotes[i]), [deck, votes, friendVotes]);
  useEffect(() => { if (step === "result" && matched.length) onMatches(matched); }, [step]); // eslint-disable-line

  const copyInvite = async () => {
    const ok = await copyText(fullLink);
    showToast(ok ? "Match link copied!" : "Select the code to copy.", null);
  };

  const shareInvite = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: `Join my SwiftStream Match (#${code})`, text: `Tap to join my Watch Match room #${code}:`, url: fullLink }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    await copyInvite();
  };

  const reset = () => { setStep("setup"); setDeck([]); setVotes([]); setFriendVotes([]); setFriendProgress(0); };
  const current = step === "swipe" ? deck[votes.length] : null;
  const next = step === "swipe" ? deck[votes.length + 1] : null;

  return (
    <Sheet
      title="Watch Match"
      subtitle={step === "setup" ? "Share your room code or enter a friend's code to swipe the exact same deck." : `Room #MATCH-${code}`}
      onClose={onClose}
    >
      {step === "setup" && (
        <div className="px-5 pb-6 space-y-5">
          <div className="rounded-3xl p-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs" style={{ color: "var(--muted)" }}>Your Room Code</p>
                <p className="display text-3xl mt-0.5 tracking-wide" style={{ fontWeight: 800, color: "var(--save)" }}>#MATCH-{code}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: friendConnected ? "rgba(92,225,196,.18)" : "rgba(255,255,255,.08)", color: friendConnected ? "var(--seen)" : "var(--muted)" }}>
                  {friendConnected ? "\u25CF Friend Connected" : simulate ? "Solo / Sim Mode" : "Waiting for friend..."}
                </span>
                <button
                  type="button"
                  onClick={() => disbandRoom(false)}
                  className="text-[11px] font-extrabold px-2.5 py-1 rounded-full transition active:scale-95"
                  style={{
                    background: friendConnected || !simulate ? "rgba(255,107,122,.18)" : "rgba(255,255,255,.07)",
                    color: friendConnected || !simulate ? "var(--skip)" : "var(--muted)",
                    border: friendConnected || !simulate ? "1px solid rgba(255,107,122,.35)" : "none",
                  }}
                >
                  {friendConnected || !simulate ? "\u2715 Disband / Leave Room" : "\u21BB New Room Code"}
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-3.5">
              <motion.button onClick={copyInvite} whileTap={{ scale: 0.96 }} className="flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold" style={{ background: "var(--surface-2)" }}>
                <CopyIcon /> Copy Link
              </motion.button>
              <motion.button onClick={shareInvite} whileTap={{ scale: 0.96 }} className="flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold" style={{ background: "var(--seen)", color: "var(--bg)" }}>
                <ShareIcon /> Share Room
              </motion.button>
            </div>

            <form onSubmit={handleJoinCode} className="mt-3.5 pt-3.5 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Have a friend's 6-digit code?"
                className="flex-1 min-w-0 rounded-full px-4 py-2 text-base sm:text-sm font-bold outline-none"
                style={{ background: "rgba(255,255,255,.06)", color: "var(--text)", border: "1px solid rgba(255,255,255,.12)" }}
              />
              <button type="submit" className="shrink-0 rounded-full px-4 py-2 text-sm font-extrabold" style={{ background: "var(--save)", color: "var(--bg)" }}>
                Join Code
              </button>
            </form>
          </div>

          <div>
            <p className="text-sm font-bold">Tonight's app</p>
            <div className="flex gap-3 overflow-x-auto no-scroll -mx-5 px-5 py-2 mt-1">
              <button onClick={() => { setProvId(null); broadcast({ type: "filter", provId: null, genre }); }} className="shrink-0 flex flex-col items-center gap-1.5">
                <span className="flex items-center justify-center rounded-[28%] text-sm font-extrabold" style={{ width: 52, height: 52, background: "var(--surface-2)", boxShadow: provId === null ? "0 0 0 3px var(--text)" : "inset 0 0 0 1px rgba(255,255,255,.12)" }}>Any</span>
                <span className="text-[11px] font-medium" style={{ color: provId === null ? "var(--text)" : "var(--muted)" }}>Any app</span>
              </button>
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => { setProvId(p.id); broadcast({ type: "filter", provId: p.id, genre }); }} className="shrink-0 flex flex-col items-center gap-1.5">
                  <span className="rounded-[28%]" style={{ boxShadow: provId === p.id ? `0 0 0 3px ${p.accent}` : undefined }}>
                    <ProviderIcon id={p.id} size={52} />
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: provId === p.id ? "var(--text)" : "var(--muted)" }}>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold">Genre</p>
            <div className="flex flex-wrap gap-2 mt-2 max-h-28 overflow-y-auto no-scroll">
              {[null, ...genreOptions].map(g => {
                const on = effGenre === g;
                return (
                  <motion.button
                    key={g || "any"}
                    onClick={() => { setGenre(g); broadcast({ type: "filter", provId, genre: g }); }}
                    whileTap={{ scale: 0.93 }}
                    className="text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-full"
                    style={{ background: on ? "var(--text)" : "var(--surface)", color: on ? "var(--bg)" : "var(--text)" }}
                  >
                    {g || "Any genre"}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl p-3.5" style={{ background: "var(--surface)" }}>
            <div>
              <p className="text-sm font-bold">Simulate friend swipes</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Turn off when swiping live with a friend using your Room Code.</p>
            </div>
            <button
              role="switch"
              aria-checked={simulate}
              onClick={() => setSimulate(v => !v)}
              className="relative shrink-0 rounded-full"
              style={{ width: 48, height: 28, background: simulate ? "var(--seen)" : "rgba(255,255,255,.18)" }}
            >
              <motion.span className="absolute top-1 left-1 w-5 h-5 rounded-full" style={{ background: simulate ? "var(--bg)" : "#fff" }} animate={{ x: simulate ? 20 : 0 }} />
            </button>
          </div>

          <motion.button
            onClick={() => begin(round)}
            disabled={pool.length === 0}
            animate={friendConnected ? { scale: [1, 1.03, 1], boxShadow: ["0 0 0 0 rgba(92,225,196,0)", "0 0 20px 4px rgba(92,225,196,0.4)", "0 0 0 0 rgba(92,225,196,0)"] } : {}}
            transition={friendConnected ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
            whileHover={{ scale: pool.length ? 1.02 : 1 }}
            whileTap={{ scale: pool.length ? 0.96 : 1 }}
            className="w-full rounded-full py-3.5 display text-lg transition-colors"
            style={{ 
              background: friendConnected ? "var(--seen)" : "var(--text)", 
              color: "var(--bg)", 
              fontWeight: 800, 
              opacity: pool.length === 0 ? 0.4 : 1 
            }}
          >
            {friendConnected ? "Ready \u2014 Start matching" : `Start matching (${deckSize} shows)`}
          </motion.button>
        </div>
      )}

      {(step === "swipe" || step === "wait") && (
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "var(--surface)", color: "var(--muted)" }}
            >
              ‹ Setup
            </button>
            <button
              type="button"
              onClick={() => disbandRoom(false)}
              className="text-xs font-extrabold px-3 py-1 rounded-full"
              style={{ background: "rgba(255,107,122,.16)", color: "var(--skip)", border: "1px solid rgba(255,107,122,.35)" }}
            >
              {"\u2715"} Leave Room
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span>You</span>
                <span style={{ color: "var(--muted)" }}>{Math.min(votes.length + (step === "swipe" ? 1 : 0), deck.length)}/{deck.length}</span>
              </div>
              <Segments n={deck.length} color={(i) => votes[i] === undefined ? (i === votes.length ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.14)") : votes[i] ? "var(--seen)" : "var(--skip)"} />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="truncate" style={{ color: "var(--muted)" }}>{simulate ? "Friend (Sim)" : `Friend (#${code})`}</span>
                <span style={{ color: "var(--muted)" }}>{friendProgress}/{deck.length}</span>
              </div>
              <Segments n={deck.length} color={(i) => (i < friendProgress ? "var(--save)" : "rgba(255,255,255,.14)")} />
            </div>
          </div>

          <div className="relative mx-auto my-4 h-[min(44vh,410px)] aspect-[2/3] max-w-full">
            {next && (
              <div className="absolute inset-0 pointer-events-none" style={{ transform: "scale(0.94) translateY(14px)", opacity: 0.55, filter: "brightness(.7)" }}>
                <PosterFace show={next} />
              </div>
            )}
            <AnimatePresence custom={dir} initial={false}>
              {current && (
                <SwipeCard
                  key={showKey(current)}
                  show={current}
                  dir={dir}
                  flipped={flipped}
                  onFlip={() => setFlipped(f => !f)}
                  onDecide={vote}
                  labels={{ right: "Yes!", left: "Nope", up: "Yes!" }}
                />
              )}
            </AnimatePresence>
          </div>

          {step === "swipe" ? (
            <div className="flex items-start justify-center gap-8">
              <motion.button onClick={() => vote("skip")} whileTap={{ scale: 0.86 }} className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, color: "var(--skip)", background: "var(--surface)", border: "2px solid var(--skip)" }}><XIcon /></motion.button>
              <motion.button onClick={() => vote("seen")} whileTap={{ scale: 0.86 }} className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, color: "var(--seen)", background: "var(--surface)", border: "2px solid var(--seen)" }}><CheckIcon /></motion.button>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="font-bold">{friendProgress >= deck.length ? "Comparing your picks..." : "Waiting for your friend to finish swiping..."}</p>
              {!simulate && friendProgress < deck.length && (
                <button onClick={() => { setFriendVotes(deck.map(() => true)); setFriendProgress(deck.length); }} className="mt-3 text-xs font-bold underline" style={{ color: "var(--save)" }}>
                  Force finish (simulate remaining swipes)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {step === "result" && (
        <div className="relative px-5 pb-6 text-center">
          {matched.length > 0 && <Confetti />}
          <h3 className="display text-4xl leading-tight pt-2" style={{ fontWeight: 800 }}>
            {matched.length > 0 ? "It's a Match! \uD83C\uDF89" : "No match this round \uD83D\uDE05"}
          </h3>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            {matched.length > 0 ? `You both said yes to ${matched.length} ${matched.length === 1 ? "show" : "shows"}.` : "Try a fresh 5-card round in the same room."}
          </p>

          {matched.length > 0 && (
            <ul className="mt-5 space-y-3 text-left">
              {matched.map(m => (
                <li key={showKey(m)} className="flex gap-3 rounded-2xl p-3" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
                  <div className="relative overflow-hidden shrink-0 rounded-xl flex items-center justify-center display text-2xl" style={{ width: 64, height: 96, fontWeight: 800, color: "rgba(255,255,255,.35)", background: "linear-gradient(160deg, #16122b, #080610)" }}>
                    {m.posterUrl ? (
                      <img src={m.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    ) : (
                      initials(m.title)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="display text-lg leading-tight" style={{ fontWeight: 800 }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{m.year} • {m.genres.join(", ")}</p>
                    <WatchNowPill show={m} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2.5 mt-6">
            <motion.button
              onClick={() => { const nextR = round + 1; setRound(nextR); setTimeout(() => begin(nextR), 20); }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 rounded-full py-3 display text-base"
              style={{ background: "var(--text)", color: "var(--bg)", fontWeight: 800 }}
            >
              Next 5 Shows
            </motion.button>
            <motion.button onClick={reset} whileTap={{ scale: 0.95 }} className="rounded-full px-4 py-3 text-sm font-bold" style={{ background: "var(--surface-2)" }}>
              Setup
            </motion.button>
            <motion.button
              onClick={() => disbandRoom(true)}
              whileTap={{ scale: 0.95 }}
              className="rounded-full px-4 py-3 text-sm font-extrabold"
              style={{ background: "rgba(255,107,122,.16)", color: "var(--skip)", border: "1px solid rgba(255,107,122,.35)" }}
            >
              Disband
            </motion.button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
export default WatchMatchModal;