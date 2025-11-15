/**
 * Marble collision and capture logic
 */

const { getHomePositions, isHomePosition } = require('../../shared/gameRules');
const { logEvent } = require('../utils/logger');

/**
 * Check for collisions and send captured marbles home
 * @param {Object} game - Game object
 * @param {number} destination - Position where marble moved
 * @param {number} currentPlayerIndex - Index of the player who just moved
 * @param {Object} state - Global state (for player names)
 * @param {Function} broadcast - Function to broadcast events
 */
function handleCollisions(game, destination, currentPlayerIndex, state, broadcast) {
  for (let i = 0; i < game.players.length; i++) {
    if (i !== currentPlayerIndex) {
      const otherPlayer = game.players[i];
      for (let j = 0; j < otherPlayer.marbles.length; j++) {
        if (otherPlayer.marbles[j] === destination && !isHomePosition(destination, i)) {
          const homePos = getHomePositions(i)[j];
          otherPlayer.marbles[j] = homePos;
          const otherPlayerName = state.players[otherPlayer.id]?.name || 'Player';
          logEvent(game, `${otherPlayerName}'s marble was sent home!`, broadcast);
        }
      }
    }
  }
}

module.exports = {
  handleCollisions,
};
