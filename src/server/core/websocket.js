/**
 * WebSocket server setup and connection handling
 */

const WebSocket = require('ws');
const { handleMessage } = require('../handlers/messageRouter');
const { send } = require('../utils/helpers');
const { PING_INTERVAL_MS } = require('../config/constants');

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @param {Object} state - Global state
 * @param {Function} broadcast - Broadcast function
 * @returns {Object} WebSocket server instance
 */
function initializeWebSocket(server, state, broadcast) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    send(ws, { type: "hello", serverTime: Date.now() });
    
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (e) {
        return;
      }

      handleMessage(ws, msg, state, broadcast);
    });

    ws.on("close", () => {
      // Cleanup if needed
    });
  });

  return wss;
}

/**
 * Start liveness ping interval
 * @param {Object} wss - WebSocket server instance
 */
function startLivenessPing(wss) {
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        try {
          ws.terminate();
        } catch (e) {}
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch (e) {}
    }
  }, PING_INTERVAL_MS);

  return interval;
}

module.exports = {
  initializeWebSocket,
  startLivenessPing,
};
