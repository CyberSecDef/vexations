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
    broadcast({ type: "eventLog", event: entry });
  }
}

module.exports = {
  logEvent,
};
