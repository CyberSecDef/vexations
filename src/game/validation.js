/**
 * Validation Utilities Module
 * Input validation and sanitization functions
 */

/**
 * Sanitize a player name
 * @param {string} name - Raw name input
 * @returns {string} Sanitized name (max 16 chars)
 */
function sanitizeName(name) {
  if (!name || typeof name !== "string") return "Player";
  return name.trim().slice(0, 16) || "Player";
}

/**
 * Validate that a player exists in the game
 * @param {Object} game - Game state object
 * @param {string} playerId - Player ID to validate
 * @returns {boolean} True if player is in the game
 */
function isPlayerInGame(game, playerId) {
  if (!game || !game.players) return false;
  return game.players.some(p => p.id === playerId);
}

/**
 * Validate that it's a specific player's turn
 * @param {Object} game - Game state object
 * @param {string} playerId - Player ID to validate
 * @returns {boolean} True if it's the player's turn
 */
function isPlayerTurn(game, playerId) {
  if (!game || !game.players || !game.players[game.player_index]) return false;
  return game.players[game.player_index].id === playerId;
}

/**
 * Validate marble index is within valid range
 * @param {number} marbleIndex - Index to validate
 * @param {Object} player - Player object
 * @returns {boolean} True if index is valid
 */
function isValidMarbleIndex(marbleIndex, player) {
  if (!player || !player.marbles) return false;
  return marbleIndex >= 0 && marbleIndex < player.marbles.length;
}

module.exports = {
  sanitizeName,
  isPlayerInGame,
  isPlayerTurn,
  isValidMarbleIndex
};
