/**
 * Game Constants
 * Shared configuration values used across the application
 */

// Server Configuration
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5000;
const PING_INTERVAL_MS = 20_000;

// Game Board Configuration
const STAR_POSITIONS = [7, 21, 35, 49];
const CENTER_POSITION = 999;
const BOARD_PATH_LENGTH = 56;

// Player Configuration
const MAX_PLAYERS = 4;
const MARBLES_PER_PLAYER = 4;

// Home Positions for each player (indexed 0-3)
const HOME_POSITIONS = [
  [101, 102, 103, 104], // Player 0 (Blue)
  [201, 202, 203, 204], // Player 1 (Yellow)
  [301, 302, 303, 304], // Player 2 (Green)
  [401, 402, 403, 404]  // Player 3 (Red)
];

// Start positions on the main path for each player
const START_POSITIONS = [0, 14, 28, 42];

// Game Phases
const PHASE_AWAITING_ROLL = 'awaiting_roll';
const PHASE_AWAITING_MOVE = 'awaiting_move';

// Dice Configuration
const DICE_MIN = 1;
const DICE_MAX = 6;
const SPECIAL_DICE_VALUES = [1, 6]; // Values that allow moving from home

module.exports = {
  HOST,
  PORT,
  PING_INTERVAL_MS,
  STAR_POSITIONS,
  CENTER_POSITION,
  BOARD_PATH_LENGTH,
  MAX_PLAYERS,
  MARBLES_PER_PLAYER,
  HOME_POSITIONS,
  START_POSITIONS,
  PHASE_AWAITING_ROLL,
  PHASE_AWAITING_MOVE,
  DICE_MIN,
  DICE_MAX,
  SPECIAL_DICE_VALUES
};
