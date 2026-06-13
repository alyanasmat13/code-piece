"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import type { GameState, PlayerInfo, Role, Team } from "@/lib/game/types";

interface RoomUpdate {
  players: PlayerInfo[];
  gameStarted: boolean;
}

export function useGameSync(roomCode: string) {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);
  // Stable ref so reconnect handler can read the name without re-running the effect
  const nameRef = useRef("");

  useEffect(() => {
    const name = localStorage.getItem("playerName") || "";
    if (!name) {
      router.replace("/");
      return;
    }
    nameRef.current = name;

    const socket = getSocket();
    setMySocketId(socket.id ?? null);

    function doJoin() {
      setMySocketId(socket.id ?? null);
      socket.emit(
        "join-room",
        { playerName: nameRef.current, roomCode },
        (res: { error?: string }) => {
          if (res?.error) router.replace("/");
        }
      );
    }

    function onRoomUpdated({ players, gameStarted }: RoomUpdate) {
      setPlayers(players);
      setGameStarted(gameStarted);
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

  const myPlayer = players.find((p) => p.socketId === mySocketId) ?? null;

  return {
    players,
    gameStarted,
    gameState,
    mySocketId,
    myPlayer,
    joinTeam,
    startGame,
    submitClue,
    guessCard,
    passTurn,
    resetGame,
    randomizeTeams,
  };
}
