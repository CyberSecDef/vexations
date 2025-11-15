#!/usr/bin/env node
/**
 * Generate browser-compatible shared.js from shared modules
 * This allows the browser client to use the same game logic as the server
 */

const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../public/shared.js');

// Read shared modules
const gameRulesPath = path.join(__dirname, '../src/shared/gameRules.js');

// Read and process files
let gameRulesCode = fs.readFileSync(gameRulesPath, 'utf8');

// Generate browser-compatible code
const output = `/**
 * Shared game constants and rules for browser
 * Auto-generated from src/shared/ - DO NOT EDIT MANUALLY
 * Run: npm run build:shared
 */

(function(window) {
  'use strict';

  // ===== CONSTANTS =====
  const STAR_POSITIONS = [7, 21, 35, 49];
  const CENTER_POSITION = 999;
  const PATH_LENGTH = 56;
  const BASE_POSITIONS = [
    [56, 57, 58, 59],
    [60, 61, 62, 63],
    [64, 65, 66, 67],
    [68, 69, 70, 71]
  ];
  const MAX_PLAYERS = 4;
  const MARBLES_PER_PLAYER = 4;
  const HOME_POSITION_BASES = [100, 200, 300, 400];
  const START_POSITIONS = [0, 14, 28, 42];
  const BOT_NAMES = ["Echo", "Data", "Bender", "Marvin"];
  const BOT_THINK_MIN_MS = 250;
  const BOT_THINK_MAX_MS = 850;
  const DICE_MIN = 1;
  const DICE_MAX = 6;
  const SPECIAL_ROLL_VALUES = [1, 6];
  const PHASE_AWAITING_ROLL = 'awaiting_roll';
  const PHASE_AWAITING_MOVE = 'awaiting_move';
  
  const GAME_PHASES = {
    AWAITING_ROLL: PHASE_AWAITING_ROLL,
    AWAITING_MOVE: PHASE_AWAITING_MOVE,
  };

  // ===== GAME RULES =====
${gameRulesCode
  // strip any CommonJS requires like: const { ... } = require('./constants');
  .replace(/const\s+\{[^}]+\}\s*=\s*require\([^)]+\);?\n?/g, '')
  // strip entire module.exports block (multi-line object literal)
  .replace(/module\.exports\s*=\s*\{[\s\S]*?\};?/gm, '')
}

  // Export to window
  window.GameShared = {
    // Constants
    STAR_POSITIONS,
    CENTER_POSITION,
    BOT_NAMES,
    GAME_PHASES,
    PATH_LENGTH,
  BASE_POSITIONS,
    MAX_PLAYERS,
    MARBLES_PER_PLAYER,
    
    // Game rules
    getHomePositions,
    getStartPosition,
    isHomePosition,
    canMoveFromHome,
    wouldBlockSelf,
  getBasePositions,
    isStarPosition,
    getValidDestinations,
    hasValidMoves,
    rollDice,
  };
  
})(window);
`;

fs.writeFileSync(outputPath, output, 'utf8');
console.log('✅ Generated public/shared.js from src/shared modules');
