"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useSocket } from "@/components/providers/socket-provider";

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

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
    const code = generateRoomCode();
    getSocket().emit(
      "create-room",
      { playerName: name.trim(), roomCode: code },
      (res: { success?: boolean; error?: string }) => {
        setLoading(null);
        if (res.error) { setError(res.error); return; }
        setPlayerName(name.trim());
        router.push(`/room/${code}`);
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
      { playerName: name.trim(), roomCode: roomCode.trim().toUpperCase() },
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
      <div className="hidden lg:flex flex-col justify-between flex-1 bg-slate-900 border-r border-slate-800 p-12">
        <div>
          <span className="inline-block bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">
            One Piece
          </span>
          <h1 className="mt-5 text-7xl font-black text-white leading-none tracking-tight">
            CODE<br />PIECE
          </h1>
          <p className="mt-6 text-slate-400 text-lg leading-relaxed max-w-xs">
            Codenames on the Grand Line. Give clever clues, find your crew&apos;s words, and avoid the Assassin.
          </p>
        </div>
        <div className="flex gap-3">
          {["Red Team", "Blue Team", "Spymaster", "Operative", "Assassin"].map((tag) => (
            <span key={tag} className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-col items-center justify-center flex-1 p-6">
        {/* Mobile title */}
        <div className="lg:hidden mb-10 text-center">
          <span className="inline-block bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4">
            One Piece
          </span>
          <h1 className="text-5xl font-black text-white tracking-tight">CODE PIECE</h1>
          <p className="mt-2 text-slate-400 text-sm">Codenames on the Grand Line</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 space-y-5">
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
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Room Code <span className="text-slate-600 normal-case font-normal">(leave blank to create)</span>
                </label>
                <input
                  type="text"
                  placeholder="ABCD"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && roomCode ? handleJoin() : handleCreate()}
                  maxLength={6}
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors uppercase tracking-[0.2em] text-sm font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCreate}
                disabled={loading !== null}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {loading === "create" ? "Creating…" : "Create Room"}
              </button>
              <button
                onClick={handleJoin}
                disabled={loading !== null}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {loading === "join" ? "Joining…" : "Join Room"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
