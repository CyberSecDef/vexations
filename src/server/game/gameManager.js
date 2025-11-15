/**
 * Game CRUD operations
 */

const { getHomePositions } = require('../../shared/gameRules');
const { token8 } = require('../utils/helpers');

/**
 * Create a new game
 * @returns {Object} The newly created game object
 */
function createGame() {
  const gameCode = token8();
  const game = {
    code: gameCode,
    players: [],
    player_index: 0,
    phase: 'awaiting_roll',
    last_roll: null,
    event_log: [],
  };
  return game;
}

/**
 * Get a game by code
 * @param {Object} state - Global state object
 * @param {string} gameCode - Game code
 * @returns {Object|null} The game object or null
 */
function getGame(state, gameCode) {
  return state.games[gameCode] || null;
}

/**
 * Add a player to a game
 * @param {Object} game - Game object
 * @param {string} playerId - Player ID
 * @returns {boolean} Success
 */
function addPlayerToGame(game, playerId) {
  if (!game.players) {
    game.players = [];
  }
  if (game.players.length >= 4) {
    return false;
  }

  const newPlayerIndex = game.players.length;
  const player = {
    id: playerId,
    marbles: getHomePositions(newPlayerIndex),
  };
  game.players.push(player);
  return true;
}

module.exports = {
  createGame,
  getGame,
  addPlayerToGame,
};
