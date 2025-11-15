/**
 * Shared game constants used by both client and server
 */

module.exports = {
  // Board positions
  STAR_POSITIONS: [7, 21, 35, 49],
  CENTER_POSITION: 999,
  PATH_LENGTH: 56,
  // Base positions: each player has 4 base slots after completing the path
  // Encoded as numeric positions starting at PATH_LENGTH (56) so indices 56..71
  BASE_POSITIONS: [
    [56, 57, 58, 59],
    [60, 61, 62, 63],
    [64, 65, 66, 67],
    [68, 69, 70, 71]
  ],
  
  // Player configuration
  MAX_PLAYERS: 4,
  MARBLES_PER_PLAYER: 4,
  HOME_POSITION_BASES: [100, 200, 300, 400],
  START_POSITIONS: [0, 14, 28, 42],
  
  // Bot configuration
  BOT_NAMES: ["Echo", "Data", "Bender", "Marvin"],
  BOT_THINK_MIN_MS: 250,
  BOT_THINK_MAX_MS: 850,
  
  // Dice configuration
  DICE_MIN: 1,
  DICE_MAX: 6,
  SPECIAL_ROLL_VALUES: [1, 6], // Can move from home
  
  // Game phases
  PHASE_AWAITING_ROLL: 'awaiting_roll',
  PHASE_AWAITING_MOVE: 'awaiting_move',
};
