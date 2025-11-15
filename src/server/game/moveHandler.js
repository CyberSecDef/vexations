/**
 * Move validation and execution
 */

const { getValidDestinations } = require('../../shared/gameRules');
const { handleCollisions } = require('./collisionHandler');
const { advanceTurn } = require('./turnManager');
const { logEvent } = require('../utils/logger');
const { checkForWinner } = require('./winner');

/**
 * Handle a marble move request
 * @param {Object} game - Game object
 * @param {string} playerId - Player ID attempting to move
 * @param {number} marbleIndex - Index of marble to move
 * @param {number} destination - Target position
 * @param {Object} state - Global state
 * @param {Function} broadcast - Function to broadcast updates
 * @returns {boolean} Success
 */
function handleMarbleMove(game, playerId, marbleIndex, destination, state, broadcast) {
  if (game.players[game.player_index].id !== playerId) {
    return false;
  }
  if (game.phase !== 'awaiting_move') {
    return false;
  }
  if (!game.last_roll) {
    return false;
  }

  const currentPlayer = game.players[game.player_index];
  
  if (marbleIndex < 0 || marbleIndex >= currentPlayer.marbles.length) {
    return false;
  }

  const currentPos = currentPlayer.marbles[marbleIndex];

  // Get all valid destinations and check if the requested destination is valid
  const validDestinations = getValidDestinations(
    currentPos,
    game.last_roll,
    game.player_index,
    currentPlayer.marbles,
    marbleIndex
  );

  if (!validDestinations.includes(destination)) {
    return false;
  }

  // Move the marble
  currentPlayer.marbles[marbleIndex] = destination;

  logEvent(game, `${state.players[playerId].name} moved marble to position ${destination}`, broadcast);

  // Check for collisions
  handleCollisions(game, destination, game.player_index, state, broadcast);

  // Check for a winner after the move/collisions
  const winner = checkForWinner(game, state, broadcast);
  if (winner) {
    // game phase and broadcast handled by checkForWinner
    return true;
  }

  // Handle turn advancement
  if (game.last_roll === 6) {
    logEvent(game, `${state.players[playerId].name} rolled a 6 and gets another turn!`, broadcast);
    game.phase = 'awaiting_roll';
    game.last_roll = null;
  } else {
    advanceTurn(game);
  }

  return true;
}

module.exports = {
  handleMarbleMove,
};
