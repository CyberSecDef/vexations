/**
 * Game State Management Module
 * Handles game state initialization, updates, and turn management
 */

const { PHASE_AWAITING_ROLL, DICE_MIN, DICE_MAX } = require('../config/constants');
const { getHomePositions } = require('./rules');

/**
 * Generate a random 8-character token for game codes
 * @returns {string} 8-character alphanumeric token
 */
function generateToken() {
  const t = Date.now(); // current time in ms
  const r = Math.floor(Math.random() * 0xffffff); // random 24-bit salt
  const mix = (t ^ r).toString(36).toUpperCase(); // xor + base36
  return (mix + Math.random().toString(36).substr(2, 8))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // strip weirds
    .slice(0, 8); // keep 8 chars
}

/**
 * Roll a six-sided die
 * @returns {number} Random number between 1 and 6
 */
function rollDice() {
  return Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1)) + DICE_MIN;
}

/**
 * Initialize a new game
 * @param {string} gameCode - Unique game code
 * @returns {Object} New game state object
 */
function initializeGame(gameCode) {
  return {
    code: gameCode,
    players: [],
    player_index: 0,
    phase: PHASE_AWAITING_ROLL,
    last_roll: null,
    event_log: []
  };
}

/**
 * Add a player to a game
 * @param {Object} game - Game state object
 * @param {string} playerId - Player ID
 * @returns {Object|null} Player object if added, null if game is full
 */
function addPlayer(game, playerId) {
  if (!game.players) {
    game.players = [];
  }

  const playerIndex = game.players.length;
  const player = {
    id: playerId,
    marbles: getHomePositions(playerIndex)
  };

  game.players.push(player);
  return player;
}

/**
 * Advance to the next player's turn
 * @param {Object} game - Game state object
 */
function advanceTurn(game) {
  game.player_index = (game.player_index + 1) % game.players.length;
  game.phase = PHASE_AWAITING_ROLL;
  game.last_roll = null;
}

/**
 * Log an event to the game's event log
 * @param {Object} game - Game state object
 * @param {string} message - Event message
 * @param {Function} broadcast - Broadcast function (optional)
 * @returns {Object} Event entry with timestamp
 */
function logEvent(game, message, broadcast = null) {
  const entry = { ts: Date.now(), message };
  if (!game.event_log) game.event_log = [];
  game.event_log.push(entry);
  if (game.event_log.length > 100) game.event_log.shift();
  
  // Broadcast event if broadcast function provided
  if (broadcast) {
    broadcast({ type: "eventLog", event: entry });
  }
  
  return entry;
}

module.exports = {
  generateToken,
  rollDice,
  initializeGame,
  addPlayer,
  advanceTurn,
  logEvent
};
