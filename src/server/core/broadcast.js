/**
 * Central broadcast helper for WebSocket server instances.
 * to share a single `broadcast` implementation without causing circular
 * requires or double-server startup.
 */

let _wss = null;

function setWebSocketServer(wss) {
  _wss = wss;
}

function broadcast(obj) {
  if (!_wss || _wss.clients.size === 0) return;
  const payload = JSON.stringify(obj);
  for (const client of _wss.clients) {
    if (client.readyState === 1) {
      try { client.send(payload); } catch (e) { /* noop */ }
    }
  }
}

module.exports = {
  setWebSocketServer,
  broadcast,
};
