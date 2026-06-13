// Temporary security smoke test — attacks the socket server the way a
// malicious client would, then verifies normal play still works.
const { io } = require("socket.io-client");

const URL = "http://localhost:3000";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const attacker = io(URL);
  await new Promise((r) => attacker.on("connect", r));
  console.log("attacker connected", attacker.id);

  // 1. Payloads that crashed the old server (destructuring undefined / callback not a function)
  attacker.emit("create-room");
  attacker.emit("create-room", null);
  attacker.emit("create-room", "just-