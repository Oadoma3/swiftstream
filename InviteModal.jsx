import { useContext } from "react";
import { motion } from "framer-motion";
import { CopyIcon, LockIcon, ShareIcon, Sheet, ToastCtx } from "./ui";
import { copyText } from "./utils";

export function InviteModal({ onClose, invite, onInvite }) {
  const showToast = useContext(ToastCtx);
  const full = "https://swiftstream-seven.vercel.app/?invite=oadoma3";

  const doCopy = async () => {
    const ok = await copyText(full);
    showToast(ok ? "Invite link copied to clipboard!" : "Select the link and copy it.", null);
    if (ok) onInvite({ sent: true });
  };

  const doShare = async () => {
    const data = { title: "Join me on SwiftStream", text: "Swipe through shows with me and find what we're watching tonight.", url: full };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(data); onInvite({ sent: true }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    await doCopy();
  };

  return (
    <Sheet title="Invite a friend" subtitle="Swipe the same shows and settle what you're watching tonight." onClose={onClose}>
      <div className="px-5 pb-6 space-y-5">
        <div>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Your personal link</p>
          <div className="mt-2 flex items-center gap-2 rounded-2xl p-1.5 pl-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)" }}>
            <input
              readOnly
              value={full}
              aria-label="Your personal invite link"
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-bold"
              style={{ color: "var(--text)", userSelect: "text" }}
            />
            <motion.button
              onClick={doCopy}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              className="shrink-0 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
              style={{ background: "var(--seen)", color: "var(--bg)" }}
            >
              <CopyIcon /> Copy Link
            </motion.button>
          </div>
          <motion.button
            onClick={doShare}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold"
            style={{ background: "var(--surface-2)" }}
          >
            <ShareIcon /> Share Link
          </motion.button>
        </div>

        <div className="rounded-3xl p-4" style={{ background: "var(--surface)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold">{invite.joined ? "Duo Mode unlocked" : "Invite 1 friend to unlock Duo Mode"}</p>
            <span
              className="shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold"
              style={invite.joined ? { background: "var(--seen)", color: "var(--bg)" } : { background: "rgba(255,200,87,.16)", color: "var(--save)" }}
            >
              {invite.joined ? <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--bg)" }} /> : <LockIcon />}
              Duo Mode: {invite.joined ? "Active" : "Locked"}
            </span>
          </div>
          <div className="mt-3 h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--seen)" }}
              initial={false}
              animate={{ width: invite.joined ? "100%" : invite.sent ? "35%" : "0%" }}
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            {invite.joined ? "Friend connected! Duo Mode is active." : invite.sent ? "Invite sent! Open Watch Match to share a 6-digit room code." : "Share your link or start a Watch Match room."}
          </p>
          {!invite.joined && (
            <button onClick={() => onInvite({ sent: true, joined: true })} className="mt-3 text-xs font-bold underline" style={{ color: "var(--save)" }}>
              Unlock Duo Mode now
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
export default InviteModal;