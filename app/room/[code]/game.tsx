"use client";

import { useState } from "react";
import type { Card, GameState, PlayerInfo, Team } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Card styling — muted, eye-friendly colors
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, { base: string; revealed: string }> = {
  red: {
    base: "bg-red-900 text-slate-200",
    revealed: "bg-red-950 text-red-400/70 opacity-60",
  },
  blue: {
    base: "bg-blue-900 text-slate-200",
    revealed: "bg-blue-950 text-blue-400/70 opacity-60",
  },
  neutral: {
    base: "bg-stone-700 text-slate-200",
    revealed: "bg-stone-900 text-stone-500 opacity-55",
  },
  assassin: {
    base: "bg-neutral-900 text-slate-300 ring-1 ring-neutral-700",
    revealed: "bg-black text-neutral-600 opacity-70",
  },
  hidden: {
    base: "bg-slate-700 text-slate-200",
    revealed: "bg-slate-700 text-slate-200",
  },
};

function cardClasses(card: Card, clickable: boolean): string {
  const styles = TYPE_STYLES[card.type] ?? TYPE_STYLES.hidden;
  const color = card.revealed ? styles.revealed : styles.base;
  const interact = clickable
    ? "cursor-pointer hover:brightness-110 active:scale-[0.97]"
    : "cursor-default";
  return [
    "flex items-center justify-center rounded-xl p-2",
    "text-center text-sm font-bold uppercase tracking-wide",
    "transition-all select-none h-16",
    color,
    interact,
  ].join(" ");
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
  onReset: () => void;
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
  onReset,
  onLeave,
}: GameViewProps) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  const { board, currentTurn, phase, currentClue, guessesLeft, winner } = state;
  const redRemaining =
    state.redRemaining ?? board.filter((c) => c.type === "red" && !c.revealed).length;
  const blueRemaining =
    state.blueRemaining ?? board.filter((c) => c.type === "blue" && !c.revealed).length;

  const isMyTurn = myPlayer?.team === currentTurn;
  const isSpymaster = myPlayer?.role === "spymaster";
  const isOperative = myPlayer?.role === "operative";

  const canGiveClue = !winner && isMyTurn && isSpymaster && phase === "clue";
  const canGuess = !winner && isMyTurn && isOperative && phase === "guess";
  const canEndTurn = !winner && isMyTurn && phase === "guess";

  function handleClueSubmit(e: React.FormEvent) {
    e.preventDefault();
    const word = clueWord.trim();
    if (!word) return;
    onSubmitClue(word, clueCount);
    setClueWord("");
    setClueCount(1);
  }

  // Score pill styles — active team is highlighted
  function scorePill(team: Team, count: number) {
    const active = !winner && currentTurn === team;
    if (team === "red") {
      return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${active ? "bg-red-900 border-red-700" : "bg-slate-800 border-slate-700"}`}>
          <span className={`text-xs font-semibold uppercase tracking-widest ${active ? "text-red-300" : "text-slate-500"}`}>Red</span>
          <span className={`text-xl font-black tabular-nums ${active ? "text-red-200" : "text-slate-500"}`}>{count}</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${active ? "bg-blue-900 border-blue-700" : "bg-slate-800 border-slate-700"}`}>
        <span className={`text-xs font-semibold uppercase tracking-widest ${active ? "text-blue-300" : "text-slate-500"}`}>Blue</span>
        <span className={`text-xl font-black tabular-nums ${active ? "text-blue-200" : "text-slate-500"}`}>{count}</span>
      </div>
    );
  }

  const turnIsRed = currentTurn === "red";
  const footerAccent = turnIsRed
    ? "border-red-900/60 bg-red-950/40"
    : "border-blue-900/60 bg-blue-950/40";
  const turnText = turnIsRed ? "text-red-300" : "text-blue-300";
  const turnLabel = turnIsRed ? "Red Team" : "Blue Team";

  return (
    <div className="flex flex-col bg-slate-950 text-white" style={{ minHeight: "100%" }}>

      {/* ── Top bar ── */}
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          {/* Room code — prominent */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mb-0.5">Room</p>
            <p className="font-mono font-black text-amber-400 text-lg tracking-widest leading-none">{code}</p>
          </div>

          {/* Scores */}
          <div className="flex gap-2 ml-2">
            {scorePill("red", redRemaining)}
            {scorePill("blue", blueRemaining)}
          </div>

          {/* My role + leave */}
          <div className="ml-auto flex items-center gap-3">
            {myPlayer && (
              <span className="hidden sm:flex items-center gap-1.5 text-sm bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
                <span className={myPlayer.team === "red" ? "text-red-400" : "text-blue-400"}>
                  {myPlayer.team === "red" ? "Red" : "Blue"}
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                  {myPlayer.role === "spymaster" ? "Spymaster" : "Operative"}
                </span>
              </span>
            )}
            <button
              onClick={onLeave}
              className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Leave
            </button>
          </div>
        </div>
      </header>

      {/* ── Win banner ── */}
      {winner && (
        <div
          className={`mx-4 mt-4 rounded-2xl border p-5 text-center shrink-0 ${
            winner === "red"
              ? "bg-red-950 border-red-800"
              : "bg-blue-950 border-blue-800"
          }`}
        >
          <p className={`text-3xl font-black ${winner === "red" ? "text-red-300" : "text-blue-300"}`}>
            {winner === "red" ? "Red" : "Blue"} Team Wins!
          </p>
          <button
            onClick={onReset}
            className="mt-3 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {/* ── Board ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-4">
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-5 gap-2">
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
        </div>
      </main>

      {/* ── Bottom clue bar ── */}
      {!winner && (
        <footer className={`shrink-0 border-t ${footerAccent}`}>
          {/* Turn label strip */}
          <div className="px-5 py-2 border-b border-slate-800/60 flex items-center gap-2">
            <span className={`text-sm font-bold ${turnText}`}>{turnLabel}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-sm">
              {phase === "clue" ? "Spymaster Phase" : "Guessing Phase"}
            </span>
          </div>

          <div className="px-5 py-3.5">
            {/* Spymaster clue input */}
            {canGiveClue && (
              <form onSubmit={handleClueSubmit} className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Your clue word…"
                    value={clueWord}
                    onChange={(e) => setClueWord(e.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-amber-500 transition-colors text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-600 rounded-xl px-3 py-3">
                  <button type="button" onClick={() => setClueCount(Math.max(0, clueCount - 1))} className="text-slate-400 hover:text-white w-5 text-center font-bold">−</button>
                  <span className="text-white font-bold w-5 text-center tabular-nums">{clueCount}</span>
                  <button type="button" onClick={() => setClueCount(Math.min(9, clueCount + 1))} className="text-slate-400 hover:text-white w-5 text-center font-bold">+</button>
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  Give Clue
                </button>
              </form>
            )}

            {/* Waiting for spymaster */}
            {!canGiveClue && phase === "clue" && (
              <p className="text-slate-500 text-sm">
                Waiting for <span className={`font-semibold ${turnText}`}>{turnLabel}</span> Spymaster to give a clue…
              </p>
            )}

            {/* Active clue display */}
            {phase === "guess" && currentClue && (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-slate-400 text-sm">Clue</span>
                  <span className="text-white text-xl font-black">&ldquo;{currentClue.word}&rdquo;</span>
                  <span className={`font-bold text-base ${turnText}`}>× {currentClue.count}</span>
                  <span className="text-slate-500 text-sm">
                    {guessesLeft} guess{guessesLeft !== 1 ? "es" : ""} remaining
                  </span>
                </div>
                {canEndTurn && (
                  <button
                    onClick={onPassTurn}
                    className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    End Turn
                  </button>
                )}
              </div>
            )}
          </div>
        </footer>
      )}

      {/* ── Player roster ── */}
      <div className="bg-slate-900/50 border-t border-slate-800 px-4 py-2 shrink-0">
        <div className="flex flex-wrap gap-x-4 gap-y-1 max-w-2xl mx-auto">
          {players.map((p) => (
            <span key={p.socketId} className="text-xs text-slate-600 flex items-center gap-1">
              <span className={p.team === "red" ? "text-red-700" : p.team === "blue" ? "text-blue-700" : "text-slate-600"}>
                {p.name}
              </span>
              {p.role && (
                <span className="text-slate-700">({p.role === "spymaster" ? "SM" : "OP"})</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
