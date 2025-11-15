/**
 * Player management
 */

const { sanitizeName } = require('../utils/helpers');

/**
 * Create or update a player
 * @param {Object} state - Global state
 * @param {string} playerId - Player ID
 * @param {string} playerName - Player name
 * @returns {Object} The player object
 */
function identifyPlayer(state, playerId, playerName) {
  if (!state.players[playerId]) {
    state.players[playerId] = {
      id: playerId,
      name: sanitizeName(playerName),
    };
  }
  state.players[playerId].connected = true;
  state.players[playerId].lastSeen = Date.now();

  return state.players[playerId];
}

module.exports = {
  identifyPlayer,
};
