"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { useGameSync } from "@/hooks/useGameSync";
import { GameView } from "./game";
import type { PlayerInfo, Role, Team } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// TeamPanel
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
  const myTeamRole = myPlayer?.team === team ? myPlayer.role : null;

  const headerBg = isRed ? "bg-red-900" : "bg-blue-900";
  const headerBorder = isRed ? "border-red-800" : "border-blue-800";
  const panelBorder = isRed ? "border-red-800/50" : "border-blue-800/50";
  const activeBtn = isRed
    ? "bg-red-900 border-red-700 text-red-100"
    : "bg-blue-900 border-blue-700 text-blue-100";

  return (
    <div className={`rounded-2xl border ${panelBorder} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className={`${headerBg} border-b ${headerBorder} px-5 py-4`}>
        <h3 className="font-black text-xl text-white">{isRed ? "Red Team" : "Blue Team"}</h3>
        <p className="text-slate-300 text-xs mt-0.5">
          {players.length} {players.length === 1 ? "player" : "players"}
        </p>
      </div>

      {/* Players */}
      <div className="bg-slate-900 p-4 flex-1 min-h-36">
        {players.length === 0 ? (
          <p className="text-slate-600 text-sm italic">No players yet — be the first!</p>
        ) : (
          <ul className="space-y-2.5">
            {players.map((p) => (
              <li key={p.socketId} className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-slate-100 font-medium text-sm truncate">{p.name}</span>
                <span
                  className={`ml-auto shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    p.role === "spymaster"
                      ? "bg-amber-900/60 border-amber-700 text-amber-300"
                      : "bg-slate-700 border-slate-600 text-slate-300"
                  }`}
                >
                  {p.role === "spymaster" ? "Spymaster" : "Operative"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Join buttons */}
      <div className="bg-slate-800 border-t border-slate-700 p-3 flex gap-2">
        <button
          onClick={() => onJoin("spymaster")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors ${
            myTeamRole === "spymaster" ? activeBtn : "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          }`}
        >
          Spymaster
        </button>
        <button
          onClick={() => onJoin("operative")}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border transition-colors ${
            myTeamRole === "operative" ? activeBtn : "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
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

  const {
    players, gameStarted, gameState, myPlayer,
    joinTeam, startGame, submitClue, guessCard,
    passTurn, resetGame, randomizeTeams,
  } = useGameSync(code);

  const redPlayers = players.filter((p) => p.team === "red");
  const bluePlayers = players.filter((p) => p.team === "blue");
  const unassigned = players.filter((p) => !p.team);

  const canStart =
    redPlayers.some((p) => p.role === "spymaster") &&
    bluePlayers.some((p) => p.role === "spymaster") &&
    redPlayers.length > 0 &&
    bluePlayers.length > 0;

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
        onReset={resetGame}
        onLeave={() => {
          getSocket().emit("leave-room", { roomCode: code });
          router.push("/");
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-slate-950 min-h-full">
      {/* Header bar */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Room Code</p>
            <h1 className="text-4xl font-black text-amber-400 tracking-widest font-mono leading-none mt-0.5">
              {code}
            </h1>
          </div>
          <p className="text-slate-400 text-sm hidden sm:block">Share this code to invite crewmates</p>
          <button
            onClick={() => {
              getSocket().emit("leave-room", { roomCode: code });
              router.push("/");
            }}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {/* Team panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamPanel team="red" players={redPlayers} myPlayer={myPlayer} onJoin={(r) => joinTeam("red", r)} />
            <TeamPanel team="blue" players={bluePlayers} myPlayer={myPlayer} onJoin={(r) => joinTeam("blue", r)} />
          </div>

          {/* Unassigned players */}
          {unassigned.length > 0 && (
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-3.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Not yet on a team</p>
              <p className="text-slate-300 text-sm">{unassigned.map((p) => p.name).join(", ")}</p>
            </div>
          )}

          {/* Error */}
          {startError && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-2.5">
              {startError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              disabled={players.length < 2}
              onClick={randomizeTeams}
              className={`rounded-xl px-5 py-3.5 text-sm font-semibold border transition-colors shrink-0 ${
                players.length >= 2
                  ? "border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700"
                  : "border-slate-800 text-slate-700 bg-slate-900 cursor-not-allowed"
              }`}
            >
              Randomize Teams
            </button>
            <button
              disabled={!canStart}
              onClick={() => { setStartError(""); startGame((err) => setStartError(err)); }}
              className={`flex-1 rounded-xl py-3.5 text-sm font-black tracking-wide transition-colors ${
                canStart
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-slate-800 text-slate-600 cursor-not-allowed"
              }`}
            >
              {canStart ? "Start Game" : "Each team needs a Spymaster"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
