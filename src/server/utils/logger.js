/**
 * Event logging utility
 */

/**
 * Log an event to the game's event log and broadcast to all clients
 */
function logEvent(game, message, broadcast) {
  const entry = { ts: Date.now(), message };
  if (!game.event_log) game.event_log = [];
  game.event_log.push(entry);
  if (game.event_log.length > 100) game.event_log.shift();
  
  if (broadcast) {
    // If the game has a code, scope the event log broadcast to that game.
    if (game && game.code) {
      broadcast({ type: "eventLog", event: entry }, game.code);
    }
  }
}

module.exports = {
  logEvent,
};
