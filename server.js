// @ts-check
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** @type {Map<string, { players: Map<string, string> }>} */
const rooms = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on("connection", (socket) => {
    /** @type {string | null} */
    let currentRoom = null;

    socket.on("create-room", ({ playerName, roomCode }, callback) => {
      if (rooms.has(roomCode)) {
        callback({ error: "Room already exists." });
        return;
      }
      const players = new Map();
      players.set(socket.id, playerName);
      rooms.set(roomCode, { players });
      currentRoom = roomCode;
      socket.join(roomCode);
      callback({ success: true });
      io.to(roomCode).emit("room-updated", {
        players: Array.from(players.values()),
      });
    });

    socket.on("join-room", ({ playerName, roomCode }, callback) => {
      const room = rooms.get(roomCode);
      if (!room) {
        callback({ error: "Room not found." });
        return;
      }
      room.players.set(socket.id, playerName);
      currentRoom = roomCode;
      socket.join(roomCode);
      callback({ success: true });
      io.to(roomCode).emit("room-updated", {
        players: Array.from(room.players.values()),
      });
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
        io.to(roomCode).emit("room-updated", {
          players: Array.from(room.players.values()),
        });
      }
    });

    socket.on("get-room", ({ roomCode }, callback) => {
      const room = rooms.get(roomCode);
      if (!room) {
        callback({ error: "Room not found." });
        return;
      }
      callback({ players: Array.from(room.players.values()) });
    });

    socket.on("disconnect", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.players.delete(socket.id);
      if (room.players.size === 0) {
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit("room-updated", {
          players: Array.from(room.players.values()),
        });
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
