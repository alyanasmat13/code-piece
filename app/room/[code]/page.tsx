"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useGameSync } from "@/hooks/useGameSync";
import { GameView } from "./game";
import type { PlayerInfo, Role, Team } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Lobby helpers
// ---------------------------------------------------------------------------

function TeamPanel({
  team,
  players,
  myPlayer,
  onJoin,
}: {
  team: Team;
  players: PlayerInfo[];
  myPlayer: PlayerInfo | null;
  onJoin: (role: Role) => void;
}) {
  const isRed = team === "red";
  const accent = isRed
    ? { border: "border-red-900/50", bg: "bg-red-950/30", text: "text-red-400", badge: "bg-red-900/50 text-red-300" }
    : { border: "border-blue-900/50", bg: "bg-blue-950/30", text: "text-blue-400", badge: "bg-blue-900/50 text-blue-300" };

  const label = isRed ? "Red Team" : "Blue Team";
  const myTeamRole = myPlayer?.team === team ? myPlayer.role : null;

  return (
    <div className={`flex-1 rounded-xl border ${accent.border} ${accent.bg} p-4 flex flex-col gap-3`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${accent.text}`}>{label}</p>

      <ul className="flex flex-col gap-1.5 min-h-[60px]">
        {players.length === 0 && (
          <li className="text-zinc-600 text-xs italic">No players yet</li>
        )}
        {players.map((p) => (
          <li key={p.socketId} className="flex items-center gap-2 text-sm text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
            <span className="truncate">{p.name}</span>
            <span className={`ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${accent.badge}`}>
              {p.role === "spymaster" ? "SM" : "OP"}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => onJoin("spymaster")}
          className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
            myTeamRole === "spymaster"
              ? `${accent.border} ${accent.text} bg-white/10`
              : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Spymaster
        </button>
        <button
          onClick={() => onJoin("operative")}
          className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
            myTeamRole === "operative"
              ? `${accent.border} ${accent.text} bg-white/10`
              : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          Operative
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [startError, setStartError] = useState("");

  const { players, gameStarted, gameState, myPlayer, mySocketId, joinTeam, startGame, submitClue, guessCard, passTurn } =
    useGameSync(code);

  const redPlayers = players.filter((p) => p.team === "red");
  const bluePlayers = players.filter((p) => p.team === "blue");
  const unassigned = players.filter((p) => !p.team);

  const canStart =
    redPlayers.some((p) => p.role === "spymaster") &&
    bluePlayers.some((p) => p.role === "spymaster") &&
    redPlayers.length > 0 &&
    bluePlayers.length > 0;

  // Transition to game view once started
  if (gameStarted && gameState) {
    return (
      <GameView
        code={code}
        state={gameState}
        players={players}
        myPlayer={myPlayer}
        onSubmitClue={submitClue}
        onGuessCard={guessCard}
        onPassTurn={passTurn}
        onLeave={() => {
          getSocket().emit("leave-room", { roomCode: code });
          router.push("/");
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 items-start justify-center bg-zinc-950 p-4 pt-8">
      <div className="w-full max-w-lg flex flex-col gap-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-zinc-500 text-xs uppercase tracking-widest">Room Code</p>
          <h1 className="text-5xl font-bold tracking-widest text-white">{code}</h1>
          <p className="text-zinc-400 text-sm">Share this code, then pick your team below</p>
        </div>

        {/* Team columns */}
        <div className="flex gap-3">
          <TeamPanel
            team="red"
            players={redPlayers}
            myPlayer={myPlayer}
            onJoin={(role) => joinTeam("red", role)}
          />
          <TeamPanel
            team="blue"
            players={bluePlayers}
            myPlayer={myPlayer}
            onJoin={(role) => joinTeam("blue", role)}
          />
        </div>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <p className="text-center text-xs text-zinc-500">
            Not assigned: {unassigned.map((p) => p.name).join(", ")}
          </p>
        )}

        {/* Start error */}
        {startError && <p className="text-center text-xs text-red-400">{startError}</p>}

        {/* Start button */}
        <button
          disabled={!canStart}
          onClick={() => {
            setStartError("");
            startGame((err) => setStartError(err));
          }}
          className={`w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-colors ${
            canStart
              ? "bg-white text-zinc-950 hover:bg-zinc-200"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          }`}
        >
          {canStart ? "Start Game" : "Need a Spymaster on each team"}
        </button>

        {/* Leave */}
        <button
          onClick={() => {
            getSocket().emit("leave-room", { roomCode: code });
            router.push("/");
          }}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
