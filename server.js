/* eslint-disable no-console */
const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

// Import configuration and modules
const { HOST, PORT, PING_INTERVAL_MS } = require("./src/config/constants");
const { handleMessage } = require("./src/websocket/handlers");
const { logEvent } = require("./src/game/state");

// Express app setup
const app = express();

// Cache control middleware
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

// Game state
let state = {
  players: {}, // playerId => { id, name, class, score, connected, lastSeen }
  games: {}, // gameCode => {players, dice, status, events}
};

// Server + WS setup
const server = http.createServer(app);

let wss = null;

/**
 * Broadcast message to all connected clients
 * @param {Object} obj - Object to broadcast
 */
function broadcast(obj) {
  // No-op if wss isn't initialized yet (e.g., during boot logging)
  if (!wss || wss.clients.size === 0) return;
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

/**
 * Create full snapshot of server state
 * @returns {Object} Snapshot object
 */
function fullSnapshot() {
  // Provide the minimum to recreate UI
  return {
    type: "snapshot",
  };
}

/**
 * Send message to specific WebSocket client
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} obj - Object to send
 */
function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    /* noop */
  }
}


// WebSocket connection handling
wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  send(ws, { type: "hello", serverTime: Date.now() });
  send(ws, fullSnapshot());

  ws.on("message", (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    // Broadcast wrapper to also log events
    const broadcastWithLog = (obj) => {
      if (obj.type === "eventLog") {
        broadcast(obj);
      } else {
        broadcast(obj);
      }
    };

    // Route message to handler
    handleMessage(msg, state, ws, send, broadcastWithLog);
  });

  ws.on("close", () => {
    // Connection closed - could track disconnections here
  });
});

// Liveness ping to terminate dead sockets
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      try {
        ws.terminate();
      } catch (e) {
        // Ignore termination errors
      }
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      // Ignore ping errors
    }
  }
}, PING_INTERVAL_MS);

// Start server
server.listen(PORT, () => {
  console.log(`✅ Vex game server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  clearInterval(interval);
  process.exit(0);
});
