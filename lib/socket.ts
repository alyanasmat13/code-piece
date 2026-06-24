import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io();
  }
  return socket;
}

const PLAYER_ID_KEY = "playerId";

// Per-tab persistent identity. sessionStorage survives page refresh but is
// scoped to the tab, so opening a second tab gives that tab its own player.
export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}
