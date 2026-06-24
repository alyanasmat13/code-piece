"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { getSocket } from "@/lib/socket";
import { useGameSync } from "@/hooks/useGameSync";
import { CATEGORIES, MIN_BOARD_WORDS, getWordPool } from "@/lib/game/categories";
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
  const activeBtn = isRed
    ? "bg-red-900 border-slate-700 text-red-100"
    : "bg-blue-900 border-slate-700 text-blue-100";

  return (
    <div className="rounded-2xl border border-slate-800 overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`${headerBg} border-b border-slate-800 px-5 py-4`}>
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
            <AnimatePresence initial={false}>
              {players.map((p) => (
                <motion.li
                  key={p.socketId}
                  layout
                  initial={{ opacity: 0, x: -8, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, x: -8, height: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="flex items-center gap-3 overflow-hidden"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 animate-pulse-soft" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  <span className="text-slate-100 font-medium text-sm truncate">{p.name}</span>
                  <span
                    className={`ml-auto shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${p.role === "spymaster"
                      ? "bg-amber-900/60 text-amber-300"
                      : "bg-slate-700 text-slate-300"
                      }`}
                  >
                    {p.role === "spymaster" ? "Spymaster" : "Operative"}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Join buttons */}
      <div className="bg-slate-800 border-t border-slate-700 p-3 flex gap-2">
        <button
          onClick={() => onJoin("spymaster")}
          className={`flex-1 rounded-xl py-2.5 text-sm cursor-pointer font-semibold border active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out ${myTeamRole === "spymaster" ? activeBtn : "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
        >
          Spymaster
        </button>
        <button
          onClick={() => onJoin("operative")}
          className={`flex-1 rounded-xl cursor-pointer py-2.5 text-sm font-semibold border active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-out ${myTeamRole === "operative" ? activeBtn : "border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
        >
          Operative
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CategoryPicker
// ---------------------------------------------------------------------------

function CategoryPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const totalWords = getWordPool(selected).length;
  const enoughWords = totalWords >= MIN_BOARD_WORDS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-lg text-white">Word Categories</h3>
        <p className={`text-xs font-semibold transition-colors ${enoughWords ? "text-slate-500" : "text-amber-400"}`}>
          {totalWords} words selected
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isSelected = selected.includes(cat.id);
          return (
            <motion.button
              key={cat.id}
              layout
              onClick={() => onToggle(cat.id)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              className={`rounded-xl cursor-pointer border px-4 py-2.5 text-sm  font-semibold transition-[background-color,color,border-color] duration-150 ease-out ${isSelected
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400"
                : "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
            >
              {cat.label}
              <span className={isSelected ? "ml-2 text-xs text-amber-400/70" : "ml-2 text-xs text-slate-600"}>
                {cat.words.length}
              </span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence>
        {!enoughWords && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="mt-3 text-xs text-amber-400 overflow-hidden"
          >
            Select at least {MIN_BOARD_WORDS} words total to start a game.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [startError, setStartError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const {
    players, gameStarted, gameState, myPlayer, selectedCategories,
    joinTeam, startGame, submitClue, guessCard,
    passTurn, resetGame, randomizeTeams, setCategories,
  } = useGameSync(code);

  const redPlayers = players.filter((p) => p.team === "red");
  const bluePlayers = players.filter((p) => p.team === "blue");
  const unassigned = players.filter((p) => !p.team);

  const enoughWords = getWordPool(selectedCategories).length >= MIN_BOARD_WORDS;
  const hasSpymasters =
    redPlayers.some((p) => p.role === "spymaster") &&
    bluePlayers.some((p) => p.role === "spymaster") &&
    redPlayers.length > 0 &&
    bluePlayers.length > 0;
  const canStart = hasSpymasters && enoughWords;

  const startLabel = !hasSpymasters
    ? "Each team needs a Spymaster"
    : !enoughWords
      ? "Select more word categories"
      : "Start Game";

  function handleToggleCategory(id: string) {
    const next = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id];
    setCategoryError("");
    setCategories(next, (err) => setCategoryError(err));
  }

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
          <p className="text-slate-400 text-sm hidden sm:block">Share this code to invite friends!</p>
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
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
              }}
            >
              <TeamPanel team="red" players={redPlayers} myPlayer={myPlayer} onJoin={(r) => joinTeam("red", r)} />
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
              }}
            >
              <TeamPanel team="blue" players={bluePlayers} myPlayer={myPlayer} onJoin={(r) => joinTeam("blue", r)} />
            </motion.div>
          </motion.div>

          {/* Unassigned players */}
          <AnimatePresence>
            {unassigned.length > 0 && (
              <motion.div
                key="unassigned"
                layout
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="bg-slate-900 border border-slate-700 rounded-xl px-5 py-3.5 overflow-hidden"
              >
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Not yet on a team</p>
                <p className="text-slate-300 text-sm">{unassigned.map((p) => p.name).join(", ")}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Errors */}
          <AnimatePresence>
            {(startError || categoryError) && (
              <motion.div
                key="lobby-error"
                layout
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="bg-red-950 border border-slate-700 text-red-300 text-sm rounded-xl px-4 py-2.5 overflow-hidden"
              >
                {startError || categoryError}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              disabled={players.length < 2}
              onClick={randomizeTeams}
              className={`rounded-xl px-5 py-3.5 cursor-pointer text-sm font-semibold border active:scale-[0.97] transition-[background-color,transform] duration-150 ease-out shrink-0 ${players.length >= 2
                ? "border-slate-600 text-slate-300 bg-slate-800 hover:bg-slate-700"
                : "border-slate-800 text-slate-700 bg-slate-900 cursor-not-allowed active:scale-100"
                }`}
            >
              Randomize Teams
            </button>
            <button
              disabled={!canStart}
              onClick={() => { setStartError(""); startGame((err) => setStartError(err)); }}
              className={`flex-1 rounded-xl cursor-pointer py-3.5 text-sm font-black tracking-wide active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out ${canStart
                ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                : "bg-slate-800 text-slate-600 cursor-not-allowed active:scale-100"
                }`}
            >
              {startLabel}
            </button>
          </div>

          {/* Word categories */}
          <CategoryPicker selected={selectedCategories} onToggle={handleToggleCategory} />
        </div>
      </div>
    </div>
  );
}
