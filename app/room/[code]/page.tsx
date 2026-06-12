"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [players, setPlayers] = useState<string[]>([]);

  useEffect(() => {
    // Read from localStorage directly so this effect only runs when `code` changes,
    // not when the provider's async localStorage load updates playerName in context.
    const name = localStorage.getItem("playerName") || "";

    if (!name) {
      router.replace("/");
      return;
    }

    const socket = getSocket();

    function onRoomUpdated({ players }: { players: string[] }) {
      setPlayers(players);
    }

    // Register listener before emitting so we never miss room-updated
    socket.on("room-updated", onRoomUpdated);

    // (Re-)join the room — handles initial join, navigation, and page refresh
    socket.emit(
      "join-room",
      { playerName: name, roomCode: code },
      (res: { success?: boolean; error?: string }) => {
        if (res.error) router.replace("/");
      }
    );

    return () => {
      socket.off("room-updated", onRoomUpdated);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-zinc-500 text-xs uppercase tracking-widest">
            Room Code
          </p>
          <h1 className="text-5xl font-bold tracking-widest text-white">
            {code}
          </h1>
          <p className="text-zinc-400 text-sm">Share this code with friends</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <p className="text-zinc-500 text-xs uppercase tracking-widest">
            Players — {players.length}
          </p>
          {players.length === 0 ? (
            <p className="text-zinc-600 text-sm">Waiting for players...</p>
          ) : (
            <ul className="space-y-2">
              {players.map((player, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-white text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {player}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => {
            getSocket().emit("leave-room", { roomCode: code });
            router.push("/");
          }}
          className="w-full rounded-lg border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-400 hover:bg-zinc-900 transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
