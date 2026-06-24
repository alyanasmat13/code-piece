// @ts-check
const { createServer } = require("http");
const { parse } = require("url");
const crypto = require("crypto");
const next = require("next");
const { Server } = require("socket.io");
const categories = require("./data/categories.json");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
// Set in production to lock socket connections to your site's origin,
// e.g. ALLOWED_ORIGIN=https://codepiece.example.com
const allowedOrigin = process.env.ALLOWED_ORIGIN || null;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ---------------------------------------------------------------------------
// Limits & validation — all socket payloads are untrusted
// ---------------------------------------------------------------------------

const MAX_ROOMS = 200;
const MAX_PLAYERS_PER_ROOM = 12;
const MAX_NAME_LENGTH = 24;
const MAX_CLUE_LENGTH = 40;
const BOARD_SIZE = 25;
const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;
// Accept UUID-ish ids — letters, digits, dashes. Bounded to prevent abuse.
const PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const VALID_TEAMS = ["red", "blue"];
const VALID_ROLES = ["spymaster", "operative"];
const CATEGORY_IDS = categories.map((c) => c.id);
const DEFAULT_CATEGORY_IDS = [...CATEGORY_IDS];
// How long a disconnected player stays in the room before being evicted.
// Long enough to cover a page refresh, short enough that ghost players
// don't linger if a tab is closed for good.
const DISCONNECT_GRACE_MS = 20_000;

/** Combine the word lists of the given category ids into one pool. */
function getWordPool(categoryIds) {
  const ids = new Set(categoryIds);
  return categories.filter((c) => ids.has(c.id)).flatMap((c) => c.words);
}

// Per-socket event rate limit (generous for normal play)
const RATE_LIMIT_MAX_EVENTS = 30;
const RATE_LIMIT_WINDOW_MS = 10_000;

/** Strip control characters, trim, and truncate. Returns null if unusable. */
function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_NAME_LENGTH);
  return name || null;
}

function sanitizeClueWord(raw) {
  if (typeof raw !== "string") return null;
  const word = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!word || word.length > MAX_CLUE_LENGTH) return null;
  return word;
}

function isValidRoomCode(code) {
  return typeof code === "string" && ROOM_CODE_RE.test(code);
}

function isValidPlayerId(id) {
  return typeof id === "string" && PLAYER_ID_RE.test(id);
}

// No 0/O or 1/I/L to keep codes easy to share verbally
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/** Acks are client-controlled; only call them if they're real functions. */
function toAck(callback) {
  return typeof callback === "function" ? callback : () => {};
}

// ---------------------------------------------------------------------------
// Inline game logic (mirrors lib/game/logic.ts — server runs plain JS)
// ---------------------------------------------------------------------------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
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
  const startingTeam = crypto.randomInt(2) === 0 ? "red" : "blue";
  const types = shuffle([
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(opponent(startingTeam)),
    ...Array(7).fill("neutral"),
    "assassin",
  ]);
  const board = shuffle(wordList)
    .slice(0, BOARD_SIZE)
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
// rooms: Map<roomCode, {
//   players: Map<playerId, {
//     name, team, role,
//     socketId: string|null,           // current live socket; null while in grace
//     disconnectTimer: NodeJS.Timeout|null,
//   }>,
//   gameState, selectedCategories,
// }>
//
// Players are keyed by a per-tab persistent playerId from the client so that
// a page refresh (which yields a brand new socket.id) reattaches to the same
// team/role record instead of re-entering as an unassigned spectator.
// ---------------------------------------------------------------------------

/** @type {Map<string, { players: Map<string, { name: string, team: string|null, role: string|null, socketId: string|null, disconnectTimer: any }>, gameState: object|null, selectedCategories: string[] }>} */
const rooms = new Map();

function clearDisconnectTimer(player) {
  if (player && player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
}

function broadcastRoomState(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = Array.from(room.players.entries()).map(([playerId, info]) => ({
    playerId,
    socketId: info.socketId || "",
    name: info.name,
    team: info.team,
    role: info.role,
  }));
  io.to(roomCode).emit("room-updated", {
    players,
    gameStarted: room.gameState !== null,
    selectedCategories: room.selectedCategories,
  });
}

function broadcastGameState(io, roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.gameState) return;

  const gs = room.gameState;
  const redRemaining = gs.board.filter((c) => c.type === "red" && !c.revealed).length;
  const blueRemaining = gs.board.filter((c) => c.type === "blue" && !c.revealed).length;

  room.players.forEach((info) => {
    // Skip players whose socket is gone (in disconnect grace). They'll receive
    // the latest state on reconnect via join-room.
    if (!info.socketId) return;
    const filtered = filterStateForPlayer(gs, info.role);
    io.to(info.socketId).emit("game-updated", { ...filtered, redRemaining, blueRemaining });
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

  const io = new Server(httpServer, {
    // Game payloads are tiny; the 1 MB default invites memory abuse
    maxHttpBufferSize: 10_000,
    ...(allowedOrigin ? { cors: { origin: allowedOrigin } } : {}),
    // WebSocket upgrades bypass CORS, so enforce the origin here too
    allowRequest: (req, cb) => {
      if (allowedOrigin && req.headers.origin && req.headers.origin !== allowedOrigin) {
        cb("origin not allowed", false);
        return;
      }
      cb(null, true);
    },
  });

  io.on("connection", (socket) => {
    /** @type {string | null} */
    let currentRoom = null;
    /** @type {string | null} */
    let playerId = null;

    // Sliding-window rate limit for this socket
    let eventCount = 0;
    let windowStart = Date.now();

    /**
     * Wrap a handler so malformed payloads can never crash the process,
     * and spammy sockets get throttled (or dropped if they keep going).
     */
    function on(event, handler) {
      socket.on(event, (...args) => {
        const now = Date.now();
        if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
          windowStart = now;
          eventCount = 0;
        }
        eventCount++;
        if (eventCount > RATE_LIMIT_MAX_EVENTS) {
          if (eventCount > RATE_LIMIT_MAX_EVENTS * 5) socket.disconnect(true);
          return;
        }
        try {
          handler(...args);
        } catch (err) {
          console.error(`Error handling "${event}" from ${socket.id}:`, err);
        }
      });
    }

    // Immediate eviction — used for explicit user actions (leave, switch room,
    // create new room while in another). Disconnects use a separate grace path.
    function removeFromCurrentRoom() {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room && playerId) {
        const player = room.players.get(playerId);
        if (player) {
          clearDisconnectTimer(player);
          room.players.delete(playerId);
        }
        if (room.players.size === 0) {
          rooms.delete(currentRoom);
        } else {
          broadcastRoomState(io, currentRoom);
        }
      }
      socket.leave(currentRoom);
      currentRoom = null;
    }

    // ---- Room events -------------------------------------------------------

    on("create-room", (payload, callback) => {
      const ack = toAck(callback);
      const playerName = sanitizeName(payload && payload.playerName);
      const newPlayerId = payload && payload.playerId;
      if (!playerName) {
        ack({ error: "Invalid player name." });
        return;
      }
      if (!isValidPlayerId(newPlayerId)) {
        ack({ error: "Invalid player id." });
        return;
      }
      if (rooms.size >= MAX_ROOMS) {
        ack({ error: "Server is full. Try again later." });
        return;
      }
      // Stash the playerId on this socket before clearing previous room — so
      // removeFromCurrentRoom can find the matching record.
      playerId = newPlayerId;
      removeFromCurrentRoom();

      // Codes are generated server-side so clients can't squat or forge them
      let roomCode;
      do {
        roomCode = generateRoomCode();
      } while (rooms.has(roomCode));

      const players = new Map();
      players.set(playerId, {
        name: playerName,
        team: null,
        role: null,
        socketId: socket.id,
        disconnectTimer: null,
      });
      rooms.set(roomCode, { players, gameState: null, selectedCategories: [...DEFAULT_CATEGORY_IDS] });
      currentRoom = roomCode;
      socket.join(roomCode);
      ack({ success: true, roomCode });
      broadcastRoomState(io, roomCode);
    });

    on("join-room", (payload, callback) => {
      const ack = toAck(callback);
      const playerName = sanitizeName(payload && payload.playerName);
      const roomCode = payload && payload.roomCode;
      const incomingPlayerId = payload && payload.playerId;
      if (!playerName || !isValidRoomCode(roomCode)) {
        ack({ error: "Invalid name or room code." });
        return;
      }
      if (!isValidPlayerId(incomingPlayerId)) {
        ack({ error: "Invalid player id." });
        return;
      }
      const room = rooms.get(roomCode);
      if (!room) {
        ack({ error: "Room not found." });
        return;
      }
      const existing = room.players.get(incomingPlayerId);
      if (!existing && room.players.size >= MAX_PLAYERS_PER_ROOM) {
        ack({ error: "Room is full." });
        return;
      }
      // Switching rooms in the same tab — evict from previous room first.
      if (currentRoom && currentRoom !== roomCode) {
        playerId = playerId || incomingPlayerId;
        removeFromCurrentRoom();
      }
      playerId = incomingPlayerId;

      if (existing) {
        // Reconnect path: cancel pending eviction, take over the record.
        clearDisconnectTimer(existing);
        existing.name = playerName;
        existing.socketId = socket.id;
      } else {
        room.players.set(playerId, {
          name: playerName,
          team: null,
          role: null,
          socketId: socket.id,
          disconnectTimer: null,
        });
      }
      currentRoom = roomCode;
      socket.join(roomCode);
      ack({ success: true });
      broadcastRoomState(io, roomCode);

      // If a game is already running, send the current filtered state
      if (room.gameState) {
        const info = room.players.get(playerId);
        const gs = room.gameState;
        const redRemaining = gs.board.filter((c) => c.type === "red" && !c.revealed).length;
        const blueRemaining = gs.board.filter((c) => c.type === "blue" && !c.revealed).length;
        const filtered = filterStateForPlayer(gs, info ? info.role : null);
        socket.emit("game-updated", { ...filtered, redRemaining, blueRemaining });
      }
    });

    on("leave-room", (payload) => {
      const roomCode = payload && payload.roomCode;
      if (!isValidRoomCode(roomCode) || roomCode !== currentRoom) return;
      removeFromCurrentRoom();
    });

    // ---- Team / role selection ---------------------------------------------

    on("join-team", (payload) => {
      const team = payload && payload.team;
      const role = payload && payload.role;
      if (!VALID_TEAMS.includes(team) || !VALID_ROLES.includes(role)) return;
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      // Disallow changing team/role once game has started
      if (!room || room.gameState) return;
      const player = room.players.get(playerId);
      if (!player) return;
      player.team = team;
      player.role = role;
      broadcastRoomState(io, currentRoom);
    });

    // ---- Word category selection -------------------------------------------

    on("set-categories", (payload, callback) => {
      const ack = toAck(callback);
      const categoryIds = payload && payload.categoryIds;
      if (!Array.isArray(categoryIds)) return;
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      // Disallow changing categories once the game has started
      if (!room || room.gameState) return;
      if (!room.players.has(playerId)) return;

      const uniqueIds = [...new Set(categoryIds)].filter(
        (id) => typeof id === "string" && CATEGORY_IDS.includes(id)
      );
      if (uniqueIds.length === 0) {
        ack({ error: "Select at least one category." });
        return;
      }
      if (getWordPool(uniqueIds).length < BOARD_SIZE) {
        ack({ error: `Selected categories need at least ${BOARD_SIZE} words combined.` });
        return;
      }

      room.selectedCategories = uniqueIds;
      broadcastRoomState(io, currentRoom);
    });

    // ---- Game lifecycle ----------------------------------------------------

    on("start-game", (callback) => {
      const ack = toAck(callback);
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      if (room.gameState) {
        ack({ error: "Game already in progress." });
        return;
      }

      const playerList = Array.from(room.players.values());
      const hasRedSpy = playerList.some((p) => p.team === "red" && p.role === "spymaster");
      const hasRedPlayer = playerList.some((p) => p.team === "red");
      const hasBlueSpy = playerList.some((p) => p.team === "blue" && p.role === "spymaster");
      const hasBluePlayer = playerList.some((p) => p.team === "blue");

      if (!hasRedSpy || !hasBlueSpy || !hasRedPlayer || !hasBluePlayer) {
        ack({ error: "Each team needs at least one Spymaster and one player." });
        return;
      }

      const wordPool = getWordPool(room.selectedCategories);
      if (wordPool.length < BOARD_SIZE) {
        ack({ error: "Not enough words selected. Enable more categories." });
        return;
      }

      room.gameState = initializeGame(wordPool);
      broadcastRoomState(io, currentRoom);
      broadcastGameState(io, currentRoom);
      ack({ success: true });
    });

    // ---- Game action events ------------------------------------------------

    on("submit-clue", (payload) => {
      const word = sanitizeClueWord(payload && payload.word);
      const count = payload && payload.count;
      // Strict integer check — NaN slips through Math.min/Math.max clamps
      if (!word || !Number.isInteger(count) || count < 0 || count > 9) return;
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(playerId);
      if (!player) return;

      const gs = room.gameState;
      if (
        gs.winner ||
        gs.phase !== "clue" ||
        player.team !== gs.currentTurn ||
        player.role !== "spymaster"
      ) return;

      room.gameState = applySubmitClue(gs, word, count);
      broadcastGameState(io, currentRoom);
    });

    on("guess-card", (payload) => {
      const cardIndex = payload && payload.cardIndex;
      if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= BOARD_SIZE) return;
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(playerId);
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

    on("randomize-teams", () => {
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      if (!room || room.gameState) return;
      if (!room.players.has(playerId)) return;

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

    on("reset-game", () => {
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.players.has(playerId)) return;
      room.gameState = null;
      broadcastRoomState(io, currentRoom);
    });

    on("end-turn", () => {
      if (!currentRoom || !playerId) return;
      const room = rooms.get(currentRoom);
      if (!room || !room.gameState) return;
      const player = room.players.get(playerId);
      if (!player) return;

      const gs = room.gameState;
      if (gs.winner || gs.phase !== "guess" || player.team !== gs.currentTurn) return;

      room.gameState = applyEndTurn(gs);
      broadcastGameState(io, currentRoom);
    });

    // ---- Disconnect --------------------------------------------------------
    //
    // Don't evict immediately — a refresh disconnects and reconnects within
    // a second or two, and we want the player to land back on their team
    // instead of as an unassigned spectator. Hold their record for
    // DISCONNECT_GRACE_MS; if no reconnect arrives, evict.
    socket.on("disconnect", () => {
      if (!currentRoom || !playerId) return;
      const capturedRoom = currentRoom;
      const capturedPlayerId = playerId;
      const capturedSocketId = socket.id;
      const room = rooms.get(capturedRoom);
      if (!room) return;
      const player = room.players.get(capturedPlayerId);
      // If a fresh socket has already taken over this playerId, leave it alone.
      if (!player || player.socketId !== capturedSocketId) return;

      player.socketId = null;
      clearDisconnectTimer(player);
      player.disconnectTimer = setTimeout(() => {
        const r = rooms.get(capturedRoom);
        if (!r) return;
        const p = r.players.get(capturedPlayerId);
        // Reconnected during grace — nothing to do.
        if (!p || p.socketId) return;
        r.players.delete(capturedPlayerId);
        if (r.players.size === 0) {
          rooms.delete(capturedRoom);
        } else {
          broadcastRoomState(io, capturedRoom);
        }
      }, DISCONNECT_GRACE_MS);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
