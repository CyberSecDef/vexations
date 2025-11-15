/**
 * Utility functions for server
 */

/**
 * Generate an 8-character alphanumeric token
 */
function token8() {
  const t = Date.now();
  const r = Math.floor(Math.random() * 0xffffff);
  const mix = (t ^ r).toString(36).toUpperCase();
  return (mix + Math.random().toString(36).substr(2, 8))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

/**
 * Sanitize player name input
 */
function sanitizeName(name) {
  if (!name || typeof name !== "string") return "Player";
  return name.trim().slice(0, 16) || "Player";
}

/**
 * Send a JSON message to a WebSocket client
 */
function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    // Connection closed or error
  }
}

module.exports = {
  token8,
  sanitizeName,
  send,
};
