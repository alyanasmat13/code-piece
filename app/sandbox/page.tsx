"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CATEGORY_IDS, getWordPool } from "@/lib/game/categories";
import {
  initializeGame,
  submitClue,
  guessCard,
  endTurn,
} from "@/lib/game/logic";
import type { Card, GameState, Team } from "@/lib/game/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cardStyle(card: Card, spymaster: boolean, clickable: boolean): string {
  const base =
    "flex items-center justify-center rounded-lg p-2 text-center text-xs font-bold uppercase tracking-wide transition-all select-none h-16 sm:h-20";

  if (card.revealed) {
    const colors: Record<string, string> = {
      red: "bg-red-700 text-white opacity-60",
      blue: "bg-blue-700 text-white opacity-60",
      neutral: "bg-stone-600 text-white opacity-60",
      assassin: "bg-zinc-950 text-zinc-500 opacity-60",
    };
    return `${base} ${colors[card.type]}`;
  }

  if (spymaster) {
    const colors: Record<string, string> = {
      red: "bg-red-700 text-white ring-2 ring-red-400",
      blue: "bg-blue-700 text-white ring-2 ring-blue-400",
      neutral: "bg-stone-600 text-white ring-2 ring-stone-400",
      assassin: "bg-zinc-900 text-zinc-300 ring-2 ring-zinc-500",
    };
    return `${base} ${colors[card.type]} ${clickable ? "cursor-pointer hover:brightness-125" : "cursor-default"}`;
  }

  return `${base} bg-zinc-700 text-zinc-100 ${
    clickable ? "cursor-pointer hover:bg-zinc-600 active:scale-95" : "cursor-default"
  }`;
}

function teamLabel(team: Team) {
  return team === "red" ? "Red" : "Blue";
}

function teamColor(team: Team) {
  return team === "red" ? "text-red-400" : "text-blue-400";
}

function remainingCount(board: Card[], team: Team) {
  return board.filter((c) => c.type === team && !c.revealed).length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SandboxPage() {
  // null until mounted on the client — avoids SSR/client Math.random() mismatch
  const [state, setState] = useState<GameState | null>(null);
  const [spymaster, setSpymaster] = useState(false);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  useEffect(() => {
    setState(initializeGame(getWordPool(DEFAULT_CATEGORY_IDS)));
  }, []);

  if (!state) return null;

  const canGuess = state.phase === "guess" && !state.winner;
  const redLeft = remainingCount(state.board, "red");
  const blueLeft = remainingCount(state.board, "blue");

  function handleGuess(index: number) {
    if (!canGuess) return;
    setState((s) => (s ? guessCard(s, index) : s));
  }

  function handleSubmitClue(e: React.FormEvent) {
    e.preventDefault();
    const word = clueWord.trim();
    if (!word) return;
    setState((s) => (s ? submitClue(s, word, clueCount) : s));
    setClueWord("");
    setClueCount(1);
  }

  function handleEndTurn() {
    setState((s) => (s ? endTurn(s) : s));
  }

  function handleReset() {
    setState(initializeGame(getWordPool(DEFAULT_CATEGORY_IDS)));
    setSpymaster(false);
    setClueWord("");
    setClueCount(1);
  }

  return (
    <div className="min-h-full bg-zinc-950 text-white p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-widest text-zinc-400 uppercase">
          Sandbox
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setSpymaster((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              spymaster
                ? "border-yellow-500 bg-yellow-500/10 text-yellow-400"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {spymaster ? "Spymaster View" : "Operative View"}
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            New Game
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-xl bg-red-950/40 border border-red-900/50 p-3 text-center">
          <p className="text-xs text-red-400 uppercase tracking-widest">Red</p>
          <p className="text-3xl font-bold text-red-400">{redLeft}</p>
          <p className="text-xs text-red-700">remaining</p>
        </div>
        <div className="flex-1 rounded-xl bg-blue-950/40 border border-blue-900/50 p-3 text-center">
          <p className="text-xs text-blue-400 uppercase tracking-widest">Blue</p>
          <p className="text-3xl font-bold text-blue-400">{blueLeft}</p>
          <p className="text-xs text-blue-700">remaining</p>
        </div>
      </div>

      {/* Win Banner */}
      {state.winner && (
        <div
          className={`rounded-xl border p-4 text-center ${
            state.winner === "red"
              ? "border-red-600 bg-red-950/60"
              : "border-blue-600 bg-blue-950/60"
          }`}
        >
          <p className={`text-2xl font-bold ${teamColor(state.winner)}`}>
            {teamLabel(state.winner)} Wins!
          </p>
          <button
            onClick={handleReset}
            className="mt-2 rounded-lg bg-white/10 px-4 py-1.5 text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {/* Turn / Phase Controls */}
      {!state.winner && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 flex flex-col gap-3">
          <p className="text-sm text-zinc-400">
            <span className={`font-bold ${teamColor(state.currentTurn)}`}>
              {teamLabel(state.currentTurn)}
            </span>{" "}
            &mdash;{" "}
            {state.phase === "clue"
              ? "Spymaster gives a clue"
              : "Operatives are guessing"}
          </p>

          {state.phase === "clue" && (
            <form onSubmit={handleSubmitClue} className="flex gap-2">
              <input
                type="text"
                placeholder="Clue word"
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
                className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white text-center outline-none focus:border-zinc-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition-colors"
              >
                Give Clue
              </button>
            </form>
          )}

          {state.phase === "guess" && state.currentClue && (
            <div className="flex items-center justify-between">
              <p className="text-sm">
                Clue:{" "}
                <span className="font-bold text-white">
                  &ldquo;{state.currentClue.word}&rdquo;
                </span>{" "}
                <span className="text-zinc-400">× {state.currentClue.count}</span>
                <span className="ml-3 text-zinc-500">
                  {state.guessesLeft} guess{state.guessesLeft !== 1 ? "es" : ""} left
                </span>
              </p>
              <button
                onClick={handleEndTurn}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
              >
                End Turn
              </button>
            </div>
          )}
        </div>
      )}

      {/* Board */}
      <div className="grid grid-cols-5 gap-2">
        {state.board.map((card, i) => (
          <button
            key={i}
            onClick={() => handleGuess(i)}
            disabled={!canGuess || card.revealed}
            className={cardStyle(card, spymaster, canGuess && !card.revealed)}
          >
            {card.word}
          </button>
        ))}
      </div>
    </div>
  );
}
