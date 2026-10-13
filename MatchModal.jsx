// MatchModal.jsx - Watch Match: two-player rapid deck, simulated friend, and the 'It's a Match!' screen.
import { useState, useEffect, useCallback, useMemo, useRef, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckIcon, CopyIcon, ProviderIcon, Sheet, ToastCtx, XIcon } from "./ui";
import { ALL_SHOWS, PROVIDERS } from "./data";
import { copyText, initials, readableText, showKey, shuffle } from "./utils";
import { PosterFace, SwipeCard } from "./Card";

/* Same affiliate behavior as the card back: brand-colored pill + redirect toast */
function WatchNowPill({ show }) {
  const showToast = useContext(ToastCtx);
  const prov = PROVIDERS.find(p => p.name === show.network);
  const brand = prov ? prov.brand : "#ffffff";
  return (
    <motion.button
      onClick={() => showToast("Redirecting to affiliate link...", show.network)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      aria-label={`Watch ${show.title} on ${show.network}`}
      className="w-full rounded-full font-extrabold py-2 text-sm mt-2.5"
      style={{ background: brand, color: readableText(brand), boxShadow: `0 8px 20px -8px ${brand}, inset 0 0 0 1.5px rgba(255,255,255,.3)` }}
    >
      Watch Now
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
    <div className="flex gap-1.5 mt-1.5">
      {Array.from({ length: n }, (_, i) => (
        <motion.div key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: color(i) }} transition={{ duration: 0.25 }} />
      ))}
    </div>
  );
}

/* 'What Are We Watching?': two-player rapid deck */
export function WatchMatchModal({ onClose, onMatches }) {
  const showToast = useContext(ToastCtx);
  const [code] = useState(() => String(Math.floor(100000 + Math.random() * 900000)));
  const link = `swipestream.app/match/${code}`;

  const [step, setStep] = useState("setup");          // setup | swipe | wait | result
  const [provId, setProvId] = useState(null);         // null = any app
  const [genre, setGenre] = useState(null);           // null = any genre
  const [simulate, setSimulate] = useState(true);
  const [deck, setDeck] = useState([]);
  const [votes, setVotes] = useState([]);             // my yes/no per card
  const [friendVotes, setFriendVotes] = useState([]);
  const [friendProgress, setFriendProgress] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState("seen");
  const used = useRef(new Set());

  const scope = useMemo(() => ALL_SHOWS.filter(s => !provId || s.providerId === provId), [provId]);
  const genreOptions = useMemo(() => [...new Set(scope.flatMap(s => s.genres))].sort(), [scope]);
  const effGenre = genre && genreOptions.includes(genre) ? genre : null;
  const pool = useMemo(() => scope.filter(s => !effGenre || s.genres.includes(effGenre)), [scope, effGenre]);
  const deckSize = Math.min(5, pool.length);

  const begin = () => {
    let fresh = pool.filter(s => !used.current.has(showKey(s)));
    if (fresh.length < deckSize) { used.current = new Set(); fresh = pool; }
    const next = shuffle(fresh).slice(0, deckSize);
    next.forEach(s => used.current.add(showKey(s)));
    // Simulated friend: says yes to ~60% of the deck, and at least two cards.
    const fv = next.map(() => Math.random() < 0.6);
    let yes = fv.filter(Boolean).length;
    for (let i = 0; yes < Math.min(2, next.length) && i < 30; i++) {
      const k = Math.floor(Math.random() * next.length);
      if (!fv[k]) { fv[k] = true; yes++; }
    }
    setDeck(next); setVotes([]); setFriendVotes(fv); setFriendProgress(0);
    setFlipped(false); setDir("seen"); setStep("swipe");
  };

  const vote = useCallback((action) => {
    if (step !== "swipe") return;
    setDir(action);
    setFlipped(false);
    setVotes(v => (v.length >= deck.length ? v : [...v, action !== "skip"]));
  }, [step, deck.length]);

  useEffect(() => {
    if (step === "swipe" && deck.length && votes.length >= deck.length) setStep("wait");
  }, [step, votes.length, deck.length]);

  // Simulated friend swipes along while you play
  useEffect(() => {
    if (!simulate || (step !== "swipe" && step !== "wait") || friendProgress >= deck.length) return;
    const id = setTimeout(() => setFriendProgress(p => Math.min(deck.length, p + 1)), 1000 + Math.random() * 600);
    return () => clearTimeout(id);
  }, [simulate, step, friendProgress, deck.length]);

  useEffect(() => {
    if (step !== "wait" || friendProgress < deck.length) return;
    const id = setTimeout(() => setStep("result"), 900);
    return () => clearTimeout(id);
  }, [step, friendProgress, deck.length]);

  const matched = useMemo(() => deck.filter((s, i) => votes[i] && friendVotes[i]), [deck, votes, friendVotes]);
  useEffect(() => { if (step === "result" && matched.length) onMatches(matched); }, [step]);

  const onKey = (e) => {
    if (step !== "swipe") return;
    const k = e.key.toLowerCase();
    if (k === "arrowright" || k === "arrowup" || k === "d" || k === "w") vote("seen");
    else if (k === "arrowleft" || k === "a") vote("skip");
    else if (k === "f") setFlipped(f => !f);
  };

  const copyInvite = async () => {
    const ok = await copyText("https://" + link);
    showToast(ok ? "Match link copied to clipboard!" : "Couldn't copy automatically. Select the code and share it.", null);
  };

  const reset = () => { setStep("setup"); setDeck([]); setVotes([]); setFriendVotes([]); setFriendProgress(0); };
  const current = step === "swipe" ? deck[votes.length] : null;
  const next = step === "swipe" ? deck[votes.length + 1] : null;

  return (
    <Sheet
      title="Watch Match"
      subtitle={step === "setup" ? "Swipe the same shows as a friend. Whatever you both like is tonight's pick." : "What are we watching tonight?"}
      onClose={onClose}
      onKey={onKey}
    >
      {/* ---------- Setup ---------- */}
      {step === "setup" && (
        <div className="px-5 pb-6 space-y-5">
          <div className="rounded-3xl p-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Room code</p>
            <p className="display text-3xl mt-1 tracking-wide" style={{ fontWeight: 800, color: "var(--save)" }} aria-label={`Room code ${code}`}>#MATCH-{code}</p>
            <div className="flex items-center gap-3 mt-3">
              <span className="flex items-center gap-2 text-sm font-bold"><span className="w-7 h-7 rounded-full flex items-center justify-center text-xs" style={{ background: "var(--seen)", color: "var(--bg)" }}>You</span></span>
              <span className="h-px flex-1" style={{ background: "rgba(255,255,255,.14)" }} />
              <span className="flex items-center gap-2 text-sm font-bold" style={{ color: simulate ? "var(--text)" : "var(--muted)" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px]" style={simulate ? { background: "var(--save)", color: "var(--bg)" } : { border: "2px dashed rgba(255,255,255,.3)" }}>{simulate ? "Fr" : "?"}</span>
                {simulate ? "Friend joined (simulated)" : "Waiting for a friend"}
              </span>
            </div>
            <motion.button
              onClick={copyInvite}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold"
              style={{ background: "var(--surface-2)" }}
            >
              <CopyIcon /> Copy Invite Link
            </motion.button>
          </div>

          <div>
            <p className="text-sm font-bold">Tonight's app</p>
            <div className="flex gap-3 overflow-x-auto no-scroll -mx-5 px-5 py-2 mt-1">
              <button
                onClick={() => setProvId(null)}
                aria-pressed={provId === null}
                className="shrink-0 flex flex-col items-center gap-1.5"
              >
                <span
                  className="flex items-center justify-center rounded-[28%] text-sm font-extrabold"
                  style={{ width: 52, height: 52, background: "var(--surface-2)", boxShadow: provId === null ? "0 0 0 3px var(--text)" : "inset 0 0 0 1px rgba(255,255,255,.12)" }}
                >Any</span>
                <span className="text-[11px] font-medium" style={{ color: provId === null ? "var(--text)" : "var(--muted)" }}>Any app</span>
              </button>
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => setProvId(p.id)} aria-pressed={provId === p.id} className="shrink-0 flex flex-col items-center gap-1.5" aria-label={p.name}>
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
            <div className="flex flex-wrap gap-2 mt-2">
              {[null, ...genreOptions].map(g => {
                const on = effGenre === g;
                return (
                  <motion.button
                    key={g || "any"}
                    onClick={() => setGenre(g)}
                    aria-pressed={on}
                    whileTap={{ scale: 0.93 }}
                    className="text-sm font-medium px-3.5 py-1.5 rounded-full"
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
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Prototype only: a pretend friend plays along so you can test solo.</p>
            </div>
            <button
              role="switch"
              aria-checked={simulate}
              aria-label="Simulate friend swipes"
              onClick={() => setSimulate(v => !v)}
              className="relative shrink-0 rounded-full"
              style={{ width: 48, height: 28, background: simulate ? "var(--seen)" : "rgba(255,255,255,.18)", transition: "background .2s" }}
            >
              <motion.span
                className="absolute top-1 left-1 w-5 h-5 rounded-full"
                style={{ background: simulate ? "var(--bg)" : "#fff" }}
                animate={{ x: simulate ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <div>
            <motion.button
              onClick={begin}
              disabled={pool.length === 0}
              whileHover={{ scale: pool.length ? 1.02 : 1 }}
              whileTap={{ scale: pool.length ? 0.96 : 1 }}
              className="w-full rounded-full py-3.5 display text-lg"
              style={{ background: "var(--text)", color: "var(--bg)", fontWeight: 800, opacity: pool.length === 0 ? 0.4 : 1 }}
            >
              Start matching
            </motion.button>
            <p className="text-xs text-center mt-2" style={{ color: "var(--muted)" }}>
              {pool.length === 0 ? "No shows fit those filters. Try another app or genre." : pool.length < 5 ? `Only ${pool.length} ${pool.length === 1 ? "show fits" : "shows fit"}, so the deck will be shorter.` : `${deckSize} shows in tonight's deck, picked from ${pool.length}.`}
            </p>
          </div>
        </div>
      )}

      {/* ---------- Swiping (you) ---------- */}
      {(step === "swipe" || step === "wait") && (
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>You</span>
            <span style={{ color: "var(--muted)" }}>{Math.min(votes.length + (step === "swipe" ? 1 : 0), deck.length)} of {deck.length}</span>
          </div>
          <Segments n={deck.length} color={(i) => votes[i] === undefined ? (i === votes.length ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.14)") : votes[i] ? "var(--seen)" : "var(--skip)"} />
          <div className="flex items-center justify-between text-xs font-bold mt-3">
            <span style={{ color: "var(--muted)" }}>Friend{simulate ? "" : " (paused)"}</span>
            <span style={{ color: "var(--muted)" }}>{friendProgress} of {deck.length}</span>
          </div>
          <Segments n={deck.length} color={(i) => (i < friendProgress ? "var(--save)" : "rgba(255,255,255,.14)")} />

          <div className="relative mx-auto my-5 h-[min(40vh,390px)] aspect-[2/3] max-w-full">
            {next && (
              <div className="absolute inset-0" style={{ transform: "scale(0.94) translateY(14px)", opacity: 0.55, filter: "brightness(.7)" }}>
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
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-start justify-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    onClick={() => vote("skip")}
                    aria-label="Nope"
                    whileHover={{ scale: 1.08, y: -2 }}
                    whileTap={{ scale: 0.86 }}
                    className="rounded-full flex items-center justify-center"
                    style={{ width: 68, height: 68, color: "var(--skip)", background: "var(--surface)", border: "2px solid var(--skip)", boxShadow: "0 10px 30px -10px var(--skip)" }}
                  ><XIcon /></motion.button>
                  <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>Nope</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    onClick={() => vote("seen")}
                    aria-label="Yes, I'd watch this"
                    whileHover={{ scale: 1.08, y: -2 }}
                    whileTap={{ scale: 0.86 }}
                    className="rounded-full flex items-center justify-center"
                    style={{ width: 68, height: 68, color: "var(--seen)", background: "var(--surface)", border: "2px solid var(--seen)", boxShadow: "0 10px 30px -10px var(--seen)" }}
                  ><CheckIcon /></motion.button>
                  <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>I'd watch it</span>
                </div>
              </div>
              {!simulate && friendProgress < deck.length && (
                <button onClick={() => setFriendProgress(deck.length)} className="text-xs font-bold underline" style={{ color: "var(--save)" }}>
                  Test: simulate friend's swipes
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="flex justify-center gap-1.5 mb-3" aria-hidden="true">
                {[0, 1, 2].map(i => (
                  <motion.span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--save)" }} animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                ))}
              </div>
              <p className="font-bold">{friendProgress >= deck.length ? "Comparing your picks..." : "Waiting for your friend to finish..."}</p>
              {!simulate && friendProgress < deck.length && (
                <motion.button
                  onClick={() => setFriendProgress(deck.length)}
                  whileTap={{ scale: 0.95 }}
                  className="mt-3 px-5 py-2.5 rounded-full text-sm font-bold"
                  style={{ background: "var(--save)", color: "var(--bg)" }}
                >
                  Simulate friend swipes
                </motion.button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------- Result ---------- */}
      {step === "result" && (
        <div className="relative px-5 pb-6 text-center">
          {matched.length > 0 && <Confetti />}
          <motion.h3
            className="display text-4xl leading-tight pt-4"
            style={{ fontWeight: 800 }}
            initial={{ scale: 0.4, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14 }}
          >
            {matched.length > 0 ? "It's a Match! 🎉" : "No match this time 😅"}
          </motion.h3>
          <p className="text-sm mt-2" style={{ color: "var(--muted)" }}>
            {matched.length > 0
              ? `You both said yes to ${matched.length} ${matched.length === 1 ? "show" : "shows"}. Saved to your Watchlist under Shared Matches.`
              : "You two didn't say yes to the same show. Try a fresh deck."}
          </p>

          {matched.length > 0 && (
            <motion.ul
              className="mt-5 space-y-3 text-left"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } } }}
            >
              {matched.map(m => (
                <motion.li
                  key={showKey(m)}
                  variants={{ hidden: { opacity: 0, y: 18, scale: 0.96 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } } }}
                  className="flex gap-3 rounded-2xl p-3"
                  style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}
                >
                  <div
                    className="shrink-0 rounded-xl flex items-center justify-center display text-2xl"
                    style={{ width: 64, height: 96, fontWeight: 800, color: "rgba(255,255,255,.35)", background: `radial-gradient(circle at 20% 15%, rgba(255,255,255,.25), transparent 50%), linear-gradient(160deg, ${m.colors[0]}, ${m.colors[1]})` }}
                    aria-hidden="true"
                  >
                    {initials(m.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="display text-lg leading-tight" style={{ fontWeight: 800 }}>{m.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{m.year}, {m.genres.join(", ")}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>Streaming on</span>
                      {m.platforms.map(pl => <ProviderIcon key={pl} name={pl} size={26} />)}
                    </div>
                    <WatchNowPill show={m} />
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}

          <div className="flex gap-3 mt-6">
            <motion.button
              onClick={begin}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 rounded-full py-3 display text-base"
              style={{ background: "var(--text)", color: "var(--bg)", fontWeight: 800 }}
            >
              Keep Swiping
            </motion.button>
            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 rounded-full py-3 text-base font-bold"
              style={{ background: "var(--surface-2)" }}
            >
              Start Over
            </motion.button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
export default WatchMatchModal;
