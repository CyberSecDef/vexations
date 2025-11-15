const { restartGame } = require('../game/winner');
const { send } = require('../utils/helpers');

function handleRestartGame(ws, msg, state, broadcast) {
  if (!msg.gameCode) {
    try { send(ws, { type: 'restart_ack', ok: false, reason: 'missing_game_code' }); } catch (e) {}
    return;
  }
  const game = state.games[msg.gameCode];
  if (!game) {
    try { send(ws, { type: 'restart_ack', ok: false, reason: 'unknown_game_code' }); } catch (e) {}
    return;
  }

  const newCode = restartGame(game, state, broadcast);
  try { send(ws, { type: 'restart_ack', ok: true, newCode }); } catch (e) {}
}

module.exports = { handleRestartGame };
