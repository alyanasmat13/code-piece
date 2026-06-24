"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { getPlayerId, getSocket } from "@/lib/socket";
import { useSocket } from "@/components/providers/socket-provider";

export default function Home() {
  const router = useRouter();
  const { setPlayerName } = useSocket();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("playerName");
    if (stored) setName(stored);
  }, []);

  function handleCreate() {
    if (!name.trim()) { setError("Enter your player name first."); return; }
    setError("");
    setLoading("create");
    // Room codes are generated server-side so they can't be forged or squatted
    getSocket().emit(
      "create-room",
      { playerName: name.trim(), playerId: getPlayerId() },
      (res: { success?: boolean; error?: string; roomCode?: string }) => {
        setLoading(null);
        if (res.error || !res.roomCode) { setError(res.error ?? "Could not create room."); return; }
        setPlayerName(name.trim());
        router.push(`/room/${res.roomCode}`);
      }
    );
  }

  function handleJoin() {
    if (!name.trim()) { setError("Enter your player name first."); return; }
    if (!roomCode.trim()) { setError("Enter a room code to join."); return; }
    setError("");
    setLoading("join");
    getSocket().emit(
      "join-room",
      { playerName: name.trim(), roomCode: roomCode.trim().toUpperCase(), playerId: getPlayerId() },
      (res: { success?: boolean; error?: string }) => {
        setLoading(null);
        if (res.error) { setError(res.error); return; }
        setPlayerName(name.trim());
        router.push(`/room/${roomCode.trim().toUpperCase()}`);
      }
    );
  }

  return (
    <div className="flex flex-1 min-h-full bg-slate-950">
      {/* Left — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between flex-1 bg-slate-900 p-12">
        <div className="animate-fade-up">
          <span className="inline-block bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            One Piece
          </span>
          <h1 className="mt-5 text-7xl font-black text-white leading-none tracking-tight">
            CODE<br />PIECE
          </h1>

          <div className="mt-8 max-w-md font-[family-name:var(--font-lora)]">
            <h2 className="text-xl font-black text-amber-400 tracking-tight mb-3">How to play</h2>
            <motion.ol
              className="space-y-3"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
              }}
            >
              {[
                { title: "Pick a role", body: "Each team has a spymaster, who sees every card's color, and operatives, who don't." },
                { title: "Give a clue", body: "On your turn, the spymaster gives one word and a number of related cards." },
                { title: "Guess the cards", body: "Operatives discuss and tap cards. Right guesses keep your turn going — the assassin ends the game." },
                { title: "Win", body: "First team to uncover all of their words wins." },
              ].map((step, i) => (
                <motion.li
                  key={step.title}
                  className="flex gap-3"
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { type: "spring", stiffness: 260, damping: 24 },
                    },
                  }}
                >
                  <span className="shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 text-xs font-bold">
                    {i + 1}
                  </span>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <span className="text-slate-100 font-semibold">{step.title}.</span> {step.body}
                  </p>
                </motion.li>
              ))}
            </motion.ol>
            <motion.p
              className="mt-5 text-xs italic text-amber-400/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.4 }}
            >
              WARNING - words and references contain One Piece manga spoilers.
            </motion.p>
          </div>
        </div>

        <p className="text-xs text-slate-500 animate-fade-up" style={{ animationDelay: "350ms" }}>
          Built by <span className="text-slate-300 font-medium">Alyan Asmat</span>
        </p>
      </div>

      {/* Right — form */}
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        {/* Mobile title */}
        <div className="lg:hidden mb-10 text-center animate-fade-up">
          <span className="inline-block bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            One Piece
          </span>
          <h1 className="text-5xl font-black text-white tracking-tight">CODE PIECE</h1>
          <p className="mt-2 text-slate-400 text-sm">Built by Alyan Asmat</p>
        </div>

        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.1 }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 space-y-5">
            <div>
              <h2 className="text-white font-bold text-xl">Set Sail</h2>
              <p className="text-slate-500 text-sm mt-0.5">Create a new room or join an existing one</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Luffy"
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-transparent focus:ring-amber-500/50 transition-shadow text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Room Code
                </label>
                <input
                  type="text"
                  placeholder="ABCD"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  maxLength={6}
                  className="w-full rounded-xl bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none ring-1 ring-transparent focus:ring-amber-500/50 transition-shadow uppercase tracking-[0.2em] text-sm font-mono"
                />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, height: 0, y: -4 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="bg-red-950 border border-slate-700 text-red-300 text-sm rounded-xl px-4 py-2.5 overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreate}
                disabled={loading !== null}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 cursor-pointer hover:bg-amber-400 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 transition-[background-color,transform] duration-150 ease-out"
              >
                {loading === "create" ? "Creating…" : "Create Room"}
              </button>
              <button
                onClick={handleJoin}
                disabled={loading !== null}
                className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 cursor-pointer hover:bg-slate-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 transition-[background-color,transform] duration-150 ease-out"
              >
                {loading === "join" ? "Joining…" : "Join Room"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
