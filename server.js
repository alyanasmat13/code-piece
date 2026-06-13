// @ts-check
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const words = require("./data/words.json");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Inline game logic (mirrors lib/game/logic.ts — server runs plain JS)
// ---------------------------------------------------------------------------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function opponent(team) {
  return team === "red" ? "blue" : "red";
}

function allRevealed(board, team) {
  return board.filter((c) => c.type === team).every((c) => c.revealed);
}

function toNextTurn(state) {
  return {
    ...state,
    currentTurn: opponent(state.currentTurn),
    phase: "clue",
    currentClue: null,
    guessesLeft: 0,
  };
}

function initializeGame(wordList) {
  const startingTeam = Math.random() < 0.5 ? "red" : "blue";
  const types = shuffle([
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(opponent(startingTeam)),
    ...Array(7).fill("neutral"),
    "assassin",
  ]);
  const board = shuffle(wordList)
    .slice(0, 25)
    .map((word, i) => ({ word, type: types[i], revealed: false }));
  return {
    board,
    currentTurn: startingTeam,
    phase: "clue",
    currentClue: null,
    guessesLeft: 0,
    winner: null,
  };
}

function applySubmitClue(state, word, count) {
  if (state.phase !== "clue" || state.winner) return state;
  return { ...state, phase: "guess", currentClue: { word, count }, guessesLeft: count + 1 };
}

function applyGuessCard(state, cardIndex) {
  if (state.phase !== "guess" || state.winner) return state;
  const card = state.board[cardIndex];
  if (!card || card.revealed) return state;

  const newBoard = state.board.map((c, i) =>
    i === cardIndex ? { ...c, revealed: true } : c
  );

  if (card.type === "assassin") {
    return { ...state, board: newBoard, winner: opponent(state.currentTurn) };
  }

  if (card.type !== state.currentTurn) {
    if (card.type !== "neutral" && allRevealed(newBoard, card.type)) {
      return { ...state, board: newBoard, winner: card.type };
    }
    return toNextTurn({ ...state, board: newBoard });
  }

  if (allRevealed(newBoard, state.currentTurn)) {
    return { ...state, board: newBoard, winner: state.currentTurn };
  }

  const guessesLeft = state.guessesLeft - 1;
  if (guessesLeft === 0) return toNextTurn({ ...state, board: newBoard });
  return { ...state, board: newBoard, guessesLeft };
}

function applyEndTurn(state) {
  if (state.phase !== "guess" || state.winner) return state;
  return toNextTurn(state);
}

// ---------------------------------------------------------------------------
// State filtering (mirrors lib/game/sync.ts)
// ---------------------------------------------------------------------------

function filterStateForPlayer(state, role) {
  if (role === "spymaster") return state;
  return {
    ...state,
    board: state.board.map((card) =>
      card.revealed ? card : { ...card, type: "hidden" }
    ),
  };
}

// ---------------------------------------------------------------------------
// Room state
// rooms: Map<roomCode, { players: Map<socketId, { name, team, role }>, gameState }>
// ---------------------------------------------------------------------------

/** @type {Map<string, { players: Map<string, { name: string, team: string|null, role: string|null }>, gameState: object|null }>} */
const rooms = new Map();

function broadcastRoomState(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = Array.from(room.players.entries()).map(([socketId, info]) => ({
    socketId,
    ...info,
  }));
  io.to(roomCode).emit("room-updated", {
    players,
    gameStarted: room.gameState !== null,
  });
}

function broadcastGameState(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;

  const gs = room.gameState;
  const redRemaining = gs.board.filter((c) => c.type === "red" && !c.revealed).length;
  const blueRemaining = gs.board.filter((c) => c.type === "blue" && !c.revealed).length;

  room.players.forEach((info, socketId) => {
    const filtered = filterStateForPlayer(gs, info.role);
    io.to(socketId).emit("game-updated", { ...filtered, redRemaining, blueRemaining });
  });
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    /** @type {string | null} */
    let currentRoom = null;

    // ---- Room events -------------------------------------------------------

    socket.on("create-room", ({ playerName, roomCode }, callback) => {
      if (rooms.has(roomCode)) {
        callback({ error: "Room already exists." });
        return;
      }
      const players = new Map();
      players.set(socket.id, { name: playerName, team: null, role: null });
      rooms.set(roomCode, { players, gameState: null });
      currentRoom = roomCode;
      socket.join(roomCode);
      callback({ success: true });
      broadcastRoomState(io, roomCode);
    });

    socket.on("join-room", ({ playerName, roomCode }, callback) => {
      const room = rooms.get(roomCode);
      if (!room) {
        callback({ error: "Room not found." });
        return;
      }
      const existing = room.players.get(socket.id);
      room.players.set(socket.id, {
        name: playerName,
        team: existing?.team ?? null,
        role: existing?.role ?? null,
      });
      currentRoom = roomCode;
      socket.join(roomCode);
      callback({ success: true });
      broadcastRoomState(io, roomCode);

      // If a game is already running, send the current filtered state
      if (room.gameState) {
        const info = room.players.get(socket.id);
        const gs = room.gameState;
        const redRemaining = gs.board.filter((c) => c.type === "red" && !c.revealed).length;
        const blueRemaining = gs.board.filter((c) => c.type === "blue" && !c.revealed).length;
        const filtered = filterStateForPlayer(gs, info?.role ?? null);
        socket.emit("game-updated", { ...filtered, redRemaining, blueRemaining });
      }
    });

    socket.on("leave-room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.players.delete(socket.id);
      socket.leave(roomCode);
      currentRoom = null;
      if (room.players.size === 0) {
        rooms.delete(roomCode);
      } else {
        broadcastRoomState(io, roomCode);
      }
    });

    // ---- Team / role selection ---------------------------------------------

    socket.on("join-team", ({ team, role }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      // Disallow changing team/role once game has started
      if (!room || room.gameState) return;
      const player = room.players.get(socket.id);
      if (!player) return;
      player.team = team;
      player.role = role;
      broadcastRoomState(io, currentRoom);
    });

    // ---- Game lifecycle ----------------------------------------------------

    socket.on("start-game", (callback) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const playerList = Array.from(room.players.values());
      const hasRedSpy = playerList.some((p) => p.team === "red" && p.role === "spymaster");
      const hasRedPlayer = playerList.some((p) => p.team === "red");
      const hasBlueSpy = playerList.some((p) => p.team === "blue" && p.role === "spymaster");
      const hasBluePlayer = playerList.some((p) => p.team === "blue");

      if (!hasRedSpy || !hasBlueSpy || !hasRedPlayer || !hasBluePlayer) {
        if (typeof callback === "function") {
          callback({ error: "Each team needs at least one Spymaster and one player." });
        }
        return;
      }

      room.gameState = initializeGame(words);
      broadcastRoomState(io, currentRoom);
      broadcastGameState(io, currentRoom);
      if (typeof callback === "function") callback({ success: true });
    });

    // ---- Game action events ------------------------------------------------

    socket.on("submit-clue", ({ word, count }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      const gs = room.gameState;
      if (
        gs.winner ||
        gs.phase !== "clue" ||
        player.team !== gs.currentTurn ||
        player.role !== "spymaster"
      ) return;

      room.gameState = applySubmitClue(gs, word.trim(), Math.max(0, Math.min(9, count)));
      broadcastGameState(io, currentRoom);
    });

    socket.on("guess-card", ({ cardIndex }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      const gs = room.gameState;
      if (
        gs.winner ||
        gs.phase !== "guess" ||
        player.team !== gs.currentTurn ||
        player.role !== "operative"
      ) return;

      room.gameState = applyGuessCard(gs, cardIndex);
      broadcastGameState(io, currentRoom);
    });

    socket.on("randomize-teams", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || room.gameState) return;

      const ids = shuffle(Array.from(room.players.keys()));
      const mid = Math.ceil(ids.length / 2);
      const redIds = ids.slice(0, mid);
      const blueIds = ids.slice(mid);

      redIds.forEach((id, i) => {
        const p = room.players.get(id);
        if (p) { p.team = "red"; p.role = i === 0 ? "spymaster" : "operative"; }
      });
      blueIds.forEach((id, i) => {
        const p = room.players.get(id);
        if (p) { p.team = "blue"; p.role = i === 0 ? "spymaster" : "operative"; }
      });

      broadcastRoomState(io, currentRoom);
    });

    socket.on("reset-game", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.gameState = null;
      broadcastRoomState(io, currentRoom);
    });

    socket.on("end-turn", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(socket.id);
      if (!player) return;

      const gs = room.gameState;
      if (gs.winner || gs.phase !== "guess" || player.team !== gs.currentTurn) return;

      room.gameState = applyEndTurn(gs);
      broadcastGameState(io, currentRoom);
    });

    // ---- Disconnect --------------------------------------------------------

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        rooms.delete(currentRoom);
      } else {
        broadcastRoomState(io, currentRoom);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
