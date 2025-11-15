/**
 * Global application state
 */

// Central state object
const state = {
  players: {}, // playerId => { id, name, connected, lastSeen }
  games: {}, // gameCode => {code, players, player_index, phase, last_roll, event_log}
};

/**
 * Get the global state
 */
function getState() {
  return state;
}

module.exports = {
  getState,
};
