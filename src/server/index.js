/* eslint-disable no-console */
/**
 * Main server entry point
 */

const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const { HOST, PORT } = require('./config/constants');
const { getState } = require('./core/state');
const { initializeWebSocket, startLivenessPing } = require('./core/websocket');

const app = express();

// Disable caching for development
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static(path.join(__dirname, "../../public"), { maxAge: 0 }));

// Get global state
const state = getState();

// Create HTTP server
const server = http.createServer(app);

const { setWebSocketServer, broadcast } = require('./core/broadcast');

// Initialize WebSocket server
const wss = initializeWebSocket(server, state, broadcast);
setWebSocketServer(wss);

// Start liveness ping
const pingInterval = startLivenessPing(wss);

// Start server
server.listen(PORT, HOST, () => {
  console.log(`✅ Vex game server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  clearInterval(pingInterval);
  process.exit(0);
});
