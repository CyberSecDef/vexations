/**
 * Game Rules Module
 * Contains core game logic and rule validation
 */

const {
  HOME_POSITIONS,
  START_POSITIONS,
  STAR_POSITIONS,
  CENTER_POSITION,
  BOARD_PATH_LENGTH,
  SPECIAL_DICE_VALUES
} = require('../config/constants');

/**
 * Get home positions for a specific player
 * @param {number} playerIndex - Player index (0-3)
 * @returns {Array<number>} Array of home position numbers
 */
function getHomePositions(playerIndex) {
  return HOME_POSITIONS[playerIndex] || [];
}

/**
 * Get start position for a specific player
 * @param {number} playerIndex - Player index (0-3)
 * @returns {number} Start position on the board
 */
function getStartPosition(playerIndex) {
  return START_POSITIONS[playerIndex] || 0;
}

/**
 * Check if a position is a home position for a player
 * @param {number} position - Position to check
 * @param {number} playerIndex - Player index (0-3)
 * @returns {boolean} True if position is a home position
 */
function isHomePosition(position, playerIndex) {
  return getHomePositions(playerIndex).includes(position);
}

/**
 * Check if a position is a star position
 * @param {number} position - Position to check
 * @returns {boolean} True if position is a star
 */
function isStarPosition(position) {
  return STAR_POSITIONS.includes(position);
}

/**
 * Check if dice value allows moving from home
 * @param {number} diceValue - Value rolled on dice
 * @returns {boolean} True if can move from home
 */
function canMoveFromHome(diceValue) {
  return SPECIAL_DICE_VALUES.includes(diceValue);
}

/**
 * Check if a marble would block itself at target position
 * @param {Array<number>} marbles - All marble positions for the player
 * @param {number} movingIndex - Index of marble being moved
 * @param {number} targetPosition - Target position to check
 * @returns {boolean} True if would block self
 */
function wouldBlockSelf(marbles, movingIndex, targetPosition) {
  for (let i = 0; i < marbles.length; i++) {
    if (i !== movingIndex && marbles[i] === targetPosition) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate all valid destinations from a position with given steps
 * Uses BFS to explore all possible paths including star hopping
 * @param {number} currentPosition - Starting position
 * @param {number} steps - Number of steps to move
 * @param {number} playerIndex - Player index (0-3)
 * @param {Array<number>} allMarbles - All marble positions for the player
 * @param {number} movingIndex - Index of marble being moved
 * @returns {Array<number>} Array of valid destination positions
 */
function getValidDestinations(currentPosition, steps, playerIndex, allMarbles, movingIndex) {
  // If currently in center: only exit on exact roll 1 to any star position
  if (currentPosition === CENTER_POSITION) {
    if (steps === 1) {
      return STAR_POSITIONS.filter(starPos => !wouldBlockSelf(allMarbles, movingIndex, starPos));
    }
    return [];
  }

  // If in home, can only move to start position with 1 or 6
  if (isHomePosition(currentPosition, playerIndex)) {
    if (canMoveFromHome(steps)) {
      const startPos = getStartPosition(playerIndex);
      if (!wouldBlockSelf(allMarbles, movingIndex, startPos)) {
        return [startPos];
      }
    }
    return [];
  }

  // BFS to explore all paths step-by-step (exact steps)
  const queue = [{ pos: currentPosition, stepsLeft: steps, visitedStars: new Set() }];
  const reachable = new Set();
  const visited = new Set();

  const makeKey = (pos, stepsLeft, visitedStars) => {
    const starList = Array.from(visitedStars).sort().join(',');
    return `${pos},${stepsLeft},${starList}`;
  };

  while (queue.length > 0) {
    const { pos, stepsLeft, visitedStars } = queue.shift();
    const key = makeKey(pos, stepsLeft, visitedStars);
    if (visited.has(key)) continue;
    visited.add(key);

    // If we've used all steps, this is a valid destination
    if (stepsLeft === 0) {
      if (pos !== currentPosition && !wouldBlockSelf(allMarbles, movingIndex, pos)) {
        reachable.add(pos);
      }
      continue;
    }

    // Normal forward 1 step along path
    const nextPos = (pos + 1) % BOARD_PATH_LENGTH;
    queue.push({ pos: nextPos, stepsLeft: stepsLeft - 1, visitedStars: new Set(visitedStars) });

    // If nextPos is a STAR, you can optionally move INTO the CENTER
    if (isStarPosition(nextPos)) {
      queue.push({ pos: CENTER_POSITION, stepsLeft: stepsLeft - 1, visitedStars: new Set(visitedStars) });
    }

    // Star teleporting: only allowed if we START on a star
    if (pos === currentPosition && isStarPosition(pos)) {
      for (const starPos of STAR_POSITIONS) {
        if (starPos !== pos && !visitedStars.has(starPos)) {
          const newVisited = new Set(visitedStars);
          newVisited.add(starPos);
          queue.push({ pos: starPos, stepsLeft: stepsLeft - 1, visitedStars: newVisited });
        }
      }
    }
  }

  return Array.from(reachable);
}

/**
 * Check if a player has any valid moves
 * @param {Object} game - Game state object
 * @param {number} playerIndex - Player index (0-3)
 * @param {number} diceValue - Current dice value
 * @returns {boolean} True if player has valid moves
 */
function hasValidMoves(game, playerIndex, diceValue) {
  const player = game.players[playerIndex];
  if (!player) return false;

  for (let i = 0; i < player.marbles.length; i++) {
    const pos = player.marbles[i];
    const validDests = getValidDestinations(pos, diceValue, playerIndex, player.marbles, i);
    if (validDests.length > 0) {
      return true;
    }
  }
  return false;
}

module.exports = {
  getHomePositions,
  getStartPosition,
  isHomePosition,
  isStarPosition,
  canMoveFromHome,
  wouldBlockSelf,
  getValidDestinations,
  hasValidMoves
};
