/**
 * Central broadcast helper for WebSocket server instances.
 * to share a single `broadcast` implementation without causing circular
 * requires or double-server startup.
 */

let _wss = null;

function setWebSocketServer(wss) {
  _wss = wss;
}

/**
 * Broadcast a message to connected clients.
 * If gameCode is provided, only clients with ws.gameCode === gameCode will receive it.
 * Otherwise the message is sent to all connected clients.
 */
function broadcast(obj, gameCode) {
  if (!_wss || _wss.clients.size === 0) return;
  const payload = JSON.stringify(obj);
  for (const client of _wss.clients) {
    try {
      if (client.readyState !== 1) continue;
      if (gameCode) {
        // Only send to clients that are associated with the same game code
        if (client.gameCode && client.gameCode === gameCode) {
          client.send(payload);
        }
      } else {
        client.send(payload);
      }
    } catch (e) { /* noop */ }
  }
}

module.exports = {
  setWebSocketServer,
  broadcast,
};
