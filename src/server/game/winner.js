const { getBasePositions } = require('../../shared/gameRules');
const { token8 } = require('../utils/helpers');
const { logEvent } = require('../utils/logger');

/**
 * Check if the player at playerIndex has all marbles in their base
 * If so, mark the game as finished and broadcast a game_over message
 */
function checkForWinner(game, state, broadcast) {
  if (!game || !game.players) return null;

  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    if (!p || !p.marbles) continue;
    const base = getBasePositions(i);
    if (!base || base.length === 0) continue;
    const allInBase = p.marbles.every(m => base.includes(m));
    if (allInBase) {
      // mark winner
      game.phase = 'finished';
      game.winner = { id: p.id, name: (state.players[p.id] && state.players[p.id].name) || 'Player', index: i };
      logEvent(game, `${game.winner.name} has won the game!`, broadcast);
      // broadcast both game_info and explicit game_over
      if (broadcast) {
        broadcast({ type: 'game_info', game: game, s: state }, game.code);
        broadcast({ type: 'game_over', winner: game.winner, game: game, s: state }, game.code);
      }
      return game.winner;
    }
  }
  return null;
}

/**
 * Restart a game: generate a new code, reset all players' marbles to home,
 * reset turn state and broadcast updated game_info.
 */
function restartGame(game, state, broadcast) {
  if (!game) return null;
  const oldCode = game.code;
  const newCode = token8();

  // reset marbles to home positions for each player index
  for (let i = 0; i < game.players.length; i++) {
    const p = game.players[i];
    const { getHomePositions } = require('../../shared/gameRules');
    p.marbles = getHomePositions(i);
  }

  game.player_index = 0;
  game.phase = 'awaiting_roll';
  game.last_roll = null;
  game.event_log = [];
  game.code = newCode;
  delete game.winner;

  // move game in state.games map
  if (state.games && oldCode && state.games[oldCode]) {
    delete state.games[oldCode];
  }
  state.games[newCode] = game;

  if (broadcast) {
    logEvent(game, `Game restarted with new code ${newCode}`, broadcast);
    broadcast({ type: 'game_info', game: game, s: state }, game.code);
  }

  return newCode;
}

module.exports = {
  checkForWinner,
  restartGame,
};
