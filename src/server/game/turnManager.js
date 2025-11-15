/**
 * Turn management and dice rolling
 */

const { rollDice, hasValidMoves } = require('../../shared/gameRules');
const { logEvent } = require('../utils/logger');

/**
 * Advance to the next player's turn
 * @param {Object} game - Game object
 */
function advanceTurn(game) {
  game.player_index = (game.player_index + 1) % game.players.length;
  game.phase = 'awaiting_roll';
  game.last_roll = null;
}

/**
 * Handle dice roll for current player
 * @param {Object} game - Game object
 * @param {string} playerId - Player ID attempting to roll
 * @param {Function} broadcast - Function to broadcast updates
 * @returns {boolean} Success
 */
function handleDiceRoll(game, playerId, broadcast) {
  if (game.players[game.player_index].id !== playerId) {
    return false;
  }
  if (game.phase !== 'awaiting_roll') {
    return false;
  }

  const diceValue = rollDice();
  game.last_roll = diceValue;
  game.phase = 'awaiting_move';

  if (!hasValidMoves(game, game.player_index, diceValue)) {
    logEvent(game, `No valid moves available. Turn skipped.`, broadcast);
    advanceTurn(game);
  }

  broadcast({ type: "dice_roll", dice: diceValue });
  return true;
}

module.exports = {
  advanceTurn,
  handleDiceRoll,
};
