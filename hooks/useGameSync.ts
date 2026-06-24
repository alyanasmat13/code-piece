"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPlayerId, getSocket } from "@/lib/socket";
import { DEFAULT_CATEGORY_IDS } from "@/lib/game/categories";
import type { GameState, PlayerInfo, Role, Team } from "@/lib/game/types";

interface RoomUpdate {
  players: PlayerInfo[];
  gameStarted: boolean;
  selectedCategories: string[];
}

export function useGameSync(roomCode: string) {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_CATEGORY_IDS);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  // Stable ref so reconnect handler can read the name without re-running the effect
  const nameRef = useRef("");

  useEffect(() => {
    // Server rejects names over 24 chars; clamp in case localStorage was edited
    const name = (localStorage.getItem("playerName") || "").trim().slice(0, 24);
    if (!name) {
      router.replace("/");
      return;
    }
    nameRef.current = name;

    const socket = getSocket();
    const playerId = getPlayerId();
    setMyPlayerId(playerId);

    function doJoin() {
      socket.emit(
        "join-room",
        { playerName: nameRef.current, roomCode, playerId },
        (res: { error?: string }) => {
          if (res?.error) router.replace("/");
        }
      );
    }

    function onRoomUpdated({ players, gameStarted, selectedCategories }: RoomUpdate) {
      setPlayers(players);
      setGameStarted(gameStarted);
      setSelectedCategories(selectedCategories);
      if (!gameStarted) setGameState(null);
    }

    function onGameUpdated(state: GameState) {
      setGameState(state);
    }

    // Re-join automatically if the socket reconnects (e.g., after a brief drop)
    socket.on("connect", doJoin);
    socket.on("room-updated", onRoomUpdated);
    socket.on("game-updated", onGameUpdated);

    // Initial join (socket may already be connected)
    if (socket.connected) {
      doJoin();
    }

    return () => {
      socket.off("connect", doJoin);
      socket.off("room-updated", onRoomUpdated);
      socket.off("game-updated", onGameUpdated);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  const joinTeam = useCallback((team: Team, role: Role) => {
    getSocket().emit("join-team", { team, role });
  }, []);

  const startGame = useCallback(
    (onError?: (msg: string) => void) => {
      getSocket().emit(
        "start-game",
        (res: { success?: boolean; error?: string }) => {
          if (res?.error) onError?.(res.error);
        }
      );
    },
    []
  );

  const submitClue = useCallback((word: string, count: number) => {
    getSocket().emit("submit-clue", { word, count });
  }, []);

  const guessCard = useCallback((cardIndex: number) => {
    getSocket().emit("guess-card", { cardIndex });
  }, []);

  const passTurn = useCallback(() => {
    getSocket().emit("end-turn");
  }, []);

  const resetGame = useCallback(() => {
    getSocket().emit("reset-game");
  }, []);

  const randomizeTeams = useCallback(() => {
    getSocket().emit("randomize-teams");
  }, []);

  const setCategories = useCallback(
    (categoryIds: string[], onError?: (msg: string) => void) => {
      getSocket().emit(
        "set-categories",
        { categoryIds },
        (res: { error?: string }) => {
          if (res?.error) onError?.(res.error);
        }
      );
    },
    []
  );

  const myPlayer = players.find((p) => p.playerId === myPlayerId) ?? null;

  return {
    players,
    gameStarted,
    gameState,
    selectedCategories,
    myPlayerId,
    myPlayer,
    joinTeam,
    startGame,
    submitClue,
    guessCard,
    passTurn,
    resetGame,
    randomizeTeams,
    setCategories,
  };
}
