/**
 * WebSocket message handlers
 */

const { createGame, getGame, addPlayerToGame } = require('../game/gameManager');
const { handleDiceRoll } = require('../game/turnManager');
const { handleMarbleMove } = require('../game/moveHandler');
const { identifyPlayer } = require('../core/playerManager');
const { send } = require('../utils/helpers');
const { handleAddBot } = require('./addBotHandler');
const { handleRestartGame } = require('./restartHandler');

/**
 * Route incoming WebSocket messages
 * @param {Object} ws - WebSocket connection
 * @param {Object} msg - Parsed message object
 * @param {Object} state - Global state
 * @param {Function} broadcast - Function to broadcast to all clients
 */
function handleMessage(ws, msg, state, broadcast) {
  switch (msg.type) {
    case "roll_dice":
      handleRollDice(ws, msg, state, broadcast);
      break;
    case "add_bot":
      handleAddBot(ws, msg, state, broadcast);
      break;
    case "restart_game":
      handleRestartGame(ws, msg, state, broadcast);
      break;
    case "move_marble":
      handleMoveMarble(ws, msg, state, broadcast);
      break;
    case "heartbeat":
      handleHeartbeat(ws, msg, state);
      break;
    case "join_game":
      handleJoinGame(ws, msg, state);
      break;
    case "new_game":
      handleNewGame(ws, msg, state);
      break;
    case "identify":
      handleIdentify(ws, msg, state);
      break;
  }
}

function handleRollDice(ws, msg, state, broadcast) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;
  
  const game = getGame(state, msg.gameCode);
  if (!game) return;
  if (game.players.filter(e => e.id === msg.playerId).length <= 0) return;

  const success = handleDiceRoll(game, msg.playerId, broadcast);
  if (success) {
    broadcast({ type: "game_info", game: game, s: state });
  }
}

function handleMoveMarble(ws, msg, state, broadcast) {
  if (!msg.playerId || !msg.gameCode || msg.marbleIndex === undefined || msg.destination === undefined) return;
  if (!state.players[msg.playerId]) return;

  const game = getGame(state, msg.gameCode);
  if (!game) return;
  if (game.players.filter(e => e.id === msg.playerId).length <= 0) return;

  const success = handleMarbleMove(
    game,
    msg.playerId,
    msg.marbleIndex,
    msg.destination,
    state,
    broadcast
  );

  if (success) {
    broadcast({ type: "game_info", game: game, s: state });
  }
}

function handleHeartbeat(ws, msg, state) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;
  
  const game = getGame(state, msg.gameCode);
  if (!game) return;
  if (!game.players || game.players.length === 0) return;

  send(ws, {
    type: "game_info",
    game: game,
    s: state,
  });
}

function handleJoinGame(ws, msg, state) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;

  const game = getGame(state, msg.gameCode);
  if (!game) return;

  const success = addPlayerToGame(game, msg.playerId);
  if (success) {
    send(ws, {
      type: "game_info",
      game: game,
      s: state,
    });
  }
}

function handleNewGame(ws, msg, state) {
  const game = createGame();
  state.games[game.code] = game;

  send(ws, { type: "game_info", game: game, s: state });
}

function handleIdentify(ws, msg, state) {
  if (!msg.playerId || !msg.playerName) return;

  const player = identifyPlayer(state, msg.playerId, msg.playerName);

  send(ws, {
    type: "identified",
    player: player,
    s: state,
  });
}

module.exports = {
  handleMessage,
};
