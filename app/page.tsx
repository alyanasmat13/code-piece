"use client";

import { useState } from "react";
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

  function handleCreate() {
    if (!name.trim()) {
      setError("Enter your player name first.");
      return;
    }
    setError("");
    setLoading("create");
    const code = generateRoomCode();
    const socket = getSocket();
    socket.emit(
      "create-room",
      { playerName: name.trim(), roomCode: code },
      (res: { success?: boolean; error?: string }) => {
        setLoading(null);
        if (res.error) {
          setError(res.error);
          return;
        }
        setPlayerName(name.trim());
        router.push(`/room/${code}`);
      }
    );
  }

  function handleJoin() {
    if (!name.trim()) {
      setError("Enter your player name first.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Enter a room code to join.");
      return;
    }
    setError("");
    setLoading("join");
    const socket = getSocket();
    socket.emit(
      "join-room",
      { playerName: name.trim(), roomCode: roomCode.trim().toUpperCase() },
      (res: { success?: boolean; error?: string }) => {
        setLoading(null);
        if (res.error) {
          setError(res.error);
          return;
        }
        setPlayerName(name.trim());
        router.push(`/room/${roomCode.trim().toUpperCase()}`);
      }
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Code Piece
          </h1>
          <p className="text-zinc-400 text-sm">One Piece Codenames</p>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
          />
          <input
            type="text"
            placeholder="Room code (to join)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors uppercase tracking-widest"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleCreate}
            disabled={loading !== null}
            className="flex-1 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading === "create" ? "Creating..." : "Create Room"}
          </button>
          <button
            onClick={handleJoin}
            disabled={loading !== null}
            className="flex-1 rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {loading === "join" ? "Joining..." : "Join Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
