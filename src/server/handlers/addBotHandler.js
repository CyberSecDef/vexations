const { send, token8 } = require('../utils/helpers');
const { getHomePositions } = require('../../shared/gameRules');
const { BOT_NAMES } = require('../../shared/constants');
const { logEvent } = require('../utils/logger');

/**
 * Handle add_bot websocket message
 */
function handleAddBot(ws, msg, state, broadcast) {
  try {
    if (!msg.gameCode) {
      try { send(ws, { type: 'add_bot_ack', ok: false, reason: 'missing_game_code' }); } catch (e) {}
      return;
    }

    const game = state.games[msg.gameCode];
    if (!game) {
      try { send(ws, { type: 'add_bot_ack', ok: false, reason: 'unknown_game_code' }); } catch (e) {}
      return;
    }

    if (!game.players) game.players = [];
    if (game.players.length >= 4) {
      try { send(ws, { type: 'add_bot_ack', ok: false, reason: 'game_full' }); } catch (e) {}
      return;
    }

    const botId = `bot-${token8()}`;
    const botName = (msg.name) ? msg.name : BOT_NAMES[game.players.length % BOT_NAMES.length] || `Bot`;
    state.players[botId] = { id: botId, name: botName, isBot: true };

    const botIndex = game.players.length;
    game.players.push({ id: botId, marbles: getHomePositions(botIndex) });

    logEvent(game, `${botName} joined the game as a bot.`, broadcast);

    try { send(ws, { type: 'add_bot_ack', ok: true, botId: botId, botName: botName, botIndex: botIndex }); } catch (e) {}

    broadcast({ type: 'game_info', game: game, s: state });

    return;
  } catch (e) {
    console.error('add_bot handler error', e);
    try { send(ws, { type: 'add_bot_ack', ok: false, reason: 'internal_error' }); } catch (e) {}
  }
}

module.exports = {
  handleAddBot,
};
