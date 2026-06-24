"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
    base: "bg-neutral-900 text-slate-300",
    revealed: "bg-black text-neutral-600 opacity-70",
  },
  hidden: {
    base: "bg-slate-700 text-slate-200",
    revealed: "bg-slate-700 text-slate-200",
  },
};

const FACE_BASE =
  "absolute inset-0 flex items-center justify-center rounded-xl p-1 sm:p-2 overflow-hidden text-center text-[10px] sm:text-xs md:text-sm lg:text-base font-bold uppercase tracking-wide leading-tight break-words hyphens-auto select-none";

function cardFaceStyles(card: Card, isSpymaster: boolean): { front: string; back: string } {
  const actual = TYPE_STYLES[card.type] ?? TYPE_STYLES.hidden;
  // Spymasters always see the actual color on the front; operatives see gray
  // until the flip reveals it.
  const front = isSpymaster ? actual.base : TYPE_STYLES.hidden.base;
  const back = actual.revealed;
  return { front, back };
}

interface GameCardProps {
  card: Card;
  clickable: boolean;
  isSpymaster: boolean;
  onClick: () => void;
}

function GameCard({ card, clickable, isSpymaster, onClick }: GameCardProps) {
  const { front, back } = cardFaceStyles(card, isSpymaster);
  const interact = clickable
    ? "cursor-pointer hover:brightness-110 active:scale-[0.97]"
    : "cursor-default";
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={`relative w-full h-full min-h-0 min-w-0 rounded-xl transition-[transform,filter] duration-150 ease-out ${interact}`}
      style={{ perspective: "1200px" }}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: card.revealed ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24, mass: 0.8 }}
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          className={`${FACE_BASE} ${front}`}
          style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
        >
          {card.word}
        </div>
        <div
          className={`${FACE_BASE} ${back}`}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {card.word}
        </div>
      </motion.div>
    </button>
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
    const isRed = team === "red";
    const bg = active ? (isRed ? "bg-red-900" : "bg-blue-900") : "bg-slate-800";
    const labelColor = active ? (isRed ? "text-red-300" : "text-blue-300") : "text-slate-500";
    const countColor = active ? (isRed ? "text-red-200" : "text-blue-200") : "text-slate-500";
    return (
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${bg}`}
      >
        <span className={`text-xs font-semibold uppercase tracking-widest ${labelColor}`}>
          {isRed ? "Red" : "Blue"}
        </span>
        <span className={`relative inline-block text-xl font-black tabular-nums leading-none ${countColor}`}>
          {/* Invisible sizer so the pill width doesn't jump as digits animate */}
          <span aria-hidden className="invisible">{count}</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={count}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 10, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {count}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.div>
    );
  }

  const turnIsRed = currentTurn === "red";
  const turnText = turnIsRed ? "text-red-300" : "text-blue-300";
  const turnLabel = turnIsRed ? "Red Team" : "Blue Team";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 text-white">

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

      {/* ── Turn / phase indicator bar ── */}
      {!winner && (
        <div className={`shrink-0 px-5 py-2.5 flex items-center gap-2.5 border-b border-slate-800 transition-colors duration-300 ease-in-out-strong ${
          turnIsRed ? "bg-red-950/50" : "bg-blue-950/50"
        }`}>
          <span className={`font-black text-base transition-colors duration-300 ease-in-out-strong ${turnText}`}>{turnLabel}</span>
          <span className="text-slate-600 text-sm">·</span>
          <span className="text-slate-400 text-sm font-medium">
            {phase === "clue" ? "Spymaster Phase" : "Guessing Phase"}
          </span>
        </div>
      )}

      {/* ── Win banner ── */}
      <AnimatePresence>
        {winner && (
          <motion.div
            key="win-banner"
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className={`mx-4 mt-4 rounded-2xl p-5 text-center shrink-0 ${
              winner === "red" ? "bg-red-950" : "bg-blue-950"
            }`}
          >
            <p className={`text-3xl font-black ${winner === "red" ? "text-red-300" : "text-blue-300"}`}>
              {winner === "red" ? "Red" : "Blue"} Team Wins!
            </p>
            <button
              onClick={onReset}
              className="mt-3 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out"
            >
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Board ── */}
      <main className="flex-1 min-h-0 flex items-center justify-center px-3 py-3 sm:px-4 sm:py-4">
        <div className="w-full max-w-5xl h-full">
          <motion.div
            className="grid grid-cols-5 grid-rows-5 gap-1.5 sm:gap-2 md:gap-3 h-full"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
            }}
          >
            {board.map((card, i) => {
              const clickable = canGuess && !card.revealed;
              return (
                <motion.div
                  key={i}
                  className="w-full h-full min-h-0 min-w-0"
                  variants={{
                    hidden: { opacity: 0, scale: 0.85 },
                    visible: {
                      opacity: 1,
                      scale: 1,
                      transition: { type: "spring", stiffness: 260, damping: 22 },
                    },
                  }}
                >
                  <GameCard
                    card={card}
                    clickable={clickable}
                    isSpymaster={!!isSpymaster}
                    onClick={() => clickable && onGuessCard(i)}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </main>

      {/* ── Bottom clue bar ── */}
      {!winner && (
        <footer className={`shrink-0 border-t border-slate-800 transition-colors duration-300 ease-in-out-strong ${turnIsRed ? "bg-red-950/30" : "bg-blue-950/30"}`}>
          <div className="px-4 py-3 sm:px-6 sm:py-4">
            {/* Spymaster clue input */}
            {canGiveClue && (
              <motion.form
                onSubmit={handleClueSubmit}
                className="flex gap-3 items-center"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
              >
                <input
                  type="text"
                  placeholder="Your clue word…"
                  value={clueWord}
                  onChange={(e) => setClueWord(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 outline-none focus:border-slate-400 transition-colors text-base"
                  autoFocus
                />
                <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-xl px-3 py-3">
                  <button type="button" onClick={() => setClueCount(Math.max(0, clueCount - 1))} className="text-slate-400 hover:text-white active:scale-[0.9] transition-[color,transform] duration-100 ease-out w-6 text-center text-lg font-bold">−</button>
                  <span className="text-white font-black text-xl w-6 text-center tabular-nums">{clueCount}</span>
                  <button type="button" onClick={() => setClueCount(Math.min(9, clueCount + 1))} className="text-slate-400 hover:text-white active:scale-[0.9] transition-[color,transform] duration-100 ease-out w-6 text-center text-lg font-bold">+</button>
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out"
                >
                  Give Clue
                </button>
              </motion.form>
            )}

            {/* Waiting for spymaster */}
            {!canGiveClue && phase === "clue" && (
              <p className="text-slate-400 text-base py-1">
                Waiting for <span className={`font-bold ${turnText}`}>{turnLabel}</span> Spymaster to give a clue…
              </p>
            )}

            {/* Active clue display */}
            <AnimatePresence mode="wait">
              {phase === "guess" && currentClue && (
                <motion.div
                  key={`${currentClue.word}-${currentClue.count}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 280, damping: 26 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-4 flex-1 flex-wrap">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Clue</p>
                      <p className="text-2xl sm:text-3xl font-black text-white leading-none">
                        &ldquo;{currentClue.word}&rdquo;
                      </p>
                    </div>
                    <div className="border-l border-slate-700 pl-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Count</p>
                      <p className={`text-2xl sm:text-3xl font-black leading-none ${turnText}`}>
                        {currentClue.count}
                      </p>
                    </div>
                    <div className="border-l border-slate-700 pl-4">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-0.5">Guesses Left</p>
                      <span className="relative inline-block text-2xl sm:text-3xl font-black text-slate-200 leading-none tabular-nums">
                        <span aria-hidden className="invisible">{guessesLeft}</span>
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={guessesLeft}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 10, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 340, damping: 28 }}
                            className="absolute inset-0 flex items-center justify-center"
                          >
                            {guessesLeft}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    </div>
                  </div>
                  {canEndTurn && (
                    <button
                      onClick={onPassTurn}
                      className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out"
                    >
                      End Turn
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
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
