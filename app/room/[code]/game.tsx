"use client";

import { useState } from "react";
import type { Card, GameState, PlayerInfo, Team } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Card styling
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, { base: string; revealed: string }> = {
  red:      { base: "bg-red-600 text-white",      revealed: "bg-red-800 text-red-300 opacity-70" },
  blue:     { base: "bg-blue-600 text-white",     revealed: "bg-blue-800 text-blue-300 opacity-70" },
  neutral:  { base: "bg-stone-500 text-white",    revealed: "bg-stone-700 text-stone-400 opacity-70" },
  assassin: { base: "bg-zinc-900 text-zinc-200 ring-1 ring-zinc-600", revealed: "bg-zinc-950 text-zinc-600 opacity-60" },
  hidden:   { base: "bg-zinc-700 text-zinc-100",  revealed: "bg-zinc-700 text-zinc-100" }, // shouldn't be revealed
};

function cardClasses(card: Card, clickable: boolean): string {
  const base =
    "flex items-center justify-center rounded-lg p-1.5 text-center text-[11px] font-bold uppercase tracking-wide transition-all select-none h-14 sm:h-18";
  const colors = TYPE_COLORS[card.type] ?? TYPE_COLORS.hidden;
  const colorClass = card.revealed ? colors.revealed : colors.base;
  const cursor = clickable ? "cursor-pointer hover:brightness-110 active:scale-95" : "cursor-default";
  return `${base} ${colorClass} ${cursor}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBar({
  redRemaining,
  blueRemaining,
  currentTurn,
  winner,
}: {
  redRemaining: number;
  blueRemaining: number;
  currentTurn: Team;
  winner: Team | null;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex-1 rounded-xl border p-3 text-center transition-all ${
          !winner && currentTurn === "red"
            ? "border-red-500 bg-red-950/50"
            : "border-red-900/40 bg-red-950/20"
        }`}
      >
        <p className="text-[10px] text-red-400 uppercase tracking-widest">Red</p>
        <p className="text-2xl font-bold text-red-400">{redRemaining}</p>
      </div>
      <div
        className={`flex-1 rounded-xl border p-3 text-center transition-all ${
          !winner && currentTurn === "blue"
            ? "border-blue-500 bg-blue-950/50"
            : "border-blue-900/40 bg-blue-950/20"
        }`}
      >
        <p className="text-[10px] text-blue-400 uppercase tracking-widest">Blue</p>
        <p className="text-2xl font-bold text-blue-400">{blueRemaining}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GameView
// ---------------------------------------------------------------------------

interface GameViewProps {
  code: string;
  state: GameState;
  players: PlayerInfo[];
  myPlayer: PlayerInfo | null;
  onSubmitClue: (word: string, count: number) => void;
  onGuessCard: (index: number) => void;
  onPassTurn: () => void;
  onLeave: () => void;
}

export function GameView({
  code,
  state,
  players,
  myPlayer,
  onSubmitClue,
  onGuessCard,
  onPassTurn,
  onLeave,
}: GameViewProps) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  const { board, currentTurn, phase, currentClue, guessesLeft, winner } = state;
  const redRemaining = state.redRemaining ?? board.filter((c) => c.type === "red" && !c.revealed).length;
  const blueRemaining = state.blueRemaining ?? board.filter((c) => c.type === "blue" && !c.revealed).length;

  const isMyTurn = myPlayer?.team === currentTurn;
  const isSpymaster = myPlayer?.role === "spymaster";
  const isOperative = myPlayer?.role === "operative";

  const canGiveClue = !winner && isMyTurn && isSpymaster && phase === "clue";
  const canGuess = !winner && isMyTurn && isOperative && phase === "guess";
  const canEndTurn = !winner && isMyTurn && phase === "guess";

  const turnLabel = currentTurn === "red" ? "Red" : "Blue";
  const turnColor = currentTurn === "red" ? "text-red-400" : "text-blue-400";

  function handleClueSubmit(e: React.FormEvent) {
    e.preventDefault();
    const word = clueWord.trim();
    if (!word) return;
    onSubmitClue(word, clueCount);
    setClueWord("");
    setClueCount(1);
  }

  return (
    <div className="min-h-full bg-zinc-950 text-white p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 font-mono tracking-widest">{code}</p>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {myPlayer && (
            <span>
              <span className={myPlayer.team === "red" ? "text-red-400" : "text-blue-400"}>
                {myPlayer.team === "red" ? "Red" : "Blue"}
              </span>
              {" · "}
              {myPlayer.role === "spymaster" ? "Spymaster" : "Operative"}
            </span>
          )}
          <button onClick={onLeave} className="hover:text-zinc-300 transition-colors">
            Leave
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <ScoreBar
        redRemaining={redRemaining}
        blueRemaining={blueRemaining}
        currentTurn={currentTurn}
        winner={winner}
      />

      {/* Win banner */}
      {winner && (
        <div
          className={`rounded-xl border p-4 text-center ${
            winner === "red" ? "border-red-600 bg-red-950/60" : "border-blue-600 bg-blue-950/60"
          }`}
        >
          <p className={`text-2xl font-bold ${winner === "red" ? "text-red-400" : "text-blue-400"}`}>
            {winner === "red" ? "Red" : "Blue"} Wins!
          </p>
        </div>
      )}

      {/* Phase controls */}
      {!winner && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex flex-col gap-2">
          <p className="text-sm text-zinc-400">
            <span className={`font-bold ${turnColor}`}>{turnLabel}</span>
            {" · "}
            {phase === "clue" ? "Spymaster's turn" : "Operatives guessing"}
          </p>

          {/* Clue input — shown to the active spymaster only */}
          {canGiveClue && (
            <form onSubmit={handleClueSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Your clue"
                value={clueWord}
                onChange={(e) => setClueWord(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
              <input
                type="number"
                min={0}
                max={9}
                value={clueCount}
                onChange={(e) => setClueCount(Number(e.target.value))}
                className="w-14 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white text-center outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
              >
                Give
              </button>
            </form>
          )}

          {/* Waiting message for non-active spymasters */}
          {!canGiveClue && phase === "clue" && (
            <p className="text-xs text-zinc-500">
              Waiting for{" "}
              <span className={turnColor}>{turnLabel}</span> Spymaster to give a clue…
            </p>
          )}

          {/* Active clue display */}
          {phase === "guess" && currentClue && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm">
                <span className="text-zinc-400">Clue: </span>
                <span className="font-bold">&ldquo;{currentClue.word}&rdquo;</span>
                <span className="text-zinc-400"> × {currentClue.count}</span>
                <span className="ml-2 text-zinc-500 text-xs">
                  ({guessesLeft} guess{guessesLeft !== 1 ? "es" : ""} left)
                </span>
              </p>
              {canEndTurn && (
                <button
                  onClick={onPassTurn}
                  className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  End Turn
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-5 gap-1.5 flex-1">
        {board.map((card, i) => {
          const clickable = canGuess && !card.revealed;
          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && onGuessCard(i)}
              className={cardClasses(card, clickable)}
            >
              {card.word}
            </button>
          );
        })}
      </div>

      {/* Player list */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {players.map((p) => (
          <span key={p.socketId} className="text-[10px] text-zinc-600">
            <span className={p.team === "red" ? "text-red-700" : p.team === "blue" ? "text-blue-700" : ""}>
              {p.name}
            </span>
            {p.role && (
              <span className="ml-0.5">({p.role === "spymaster" ? "SM" : "OP"})</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
