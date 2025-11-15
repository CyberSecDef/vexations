/**
 * WebSocket Message Handlers Module
 * Handles incoming WebSocket messages and game actions
 */

const { 
  PHASE_AWAITING_ROLL, 
  PHASE_AWAITING_MOVE,
  MAX_PLAYERS 
} = require('../config/constants');
const { 
  getValidDestinations, 
  hasValidMoves,
  getHomePositions,
  isHomePosition 
} = require('../game/rules');
const { 
  rollDice, 
  initializeGame, 
  addPlayer, 
  advanceTurn, 
  logEvent,
  generateToken 
} = require('../game/state');
const { 
  sanitizeName, 
  isPlayerInGame, 
  isPlayerTurn,
  isValidMarbleIndex 
} = require('../game/validation');

/**
 * Handle player identification
 */
function handleIdentify(msg, state, ws, send) {
  if (!msg.playerId || !msg.playerName) {
    return;
  }
  
  if (!state.players[msg.playerId]) {
    state.players[msg.playerId] = {
      id: msg.playerId,
      name: sanitizeName(msg.playerName),
      connected: true,
      lastSeen: Date.now()
    };
  } else {
    state.players[msg.playerId].connected = true;
    state.players[msg.playerId].lastSeen = Date.now();
  }

  send(ws, {
    type: "identified",
    player: state.players[msg.playerId],
    s: state
  });
}

/**
 * Handle new game creation
 */
function handleNewGame(msg, state, ws, send) {
  const gameCode = generateToken();
  const game = initializeGame(gameCode);
  state.games[gameCode] = game;

  send(ws, { 
    type: "game_info", 
    game: state.games[gameCode], 
    s: state 
  });
}

/**
 * Handle player joining a game
 */
function handleJoinGame(msg, state, ws, send) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;
  if (!state.games[msg.gameCode]) return;

  const game = state.games[msg.gameCode];
  
  if (!game.players) {
    game.players = [];
  }
  
  if (game.players.length >= MAX_PLAYERS) return;

  addPlayer(game, msg.playerId);

  send(ws, {
    type: "game_info",
    game: game,
    s: state
  });
}

/**
 * Handle heartbeat/status check
 */
function handleHeartbeat(msg, state, ws, send) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;
  if (!state.games[msg.gameCode]) return;
  if (!state.games[msg.gameCode].players) return;
  if (state.games[msg.gameCode].players.length === 0) return;

  send(ws, {
    type: "game_info",
    game: state.games[msg.gameCode],
    s: state
  });
}

/**
 * Handle dice roll
 */
function handleRollDice(msg, state, ws, broadcast) {
  if (!msg.playerId || !msg.gameCode) return;
  if (!state.players[msg.playerId]) return;
  if (!state.games[msg.gameCode]) return;

  const game = state.games[msg.gameCode];
  
  if (!isPlayerInGame(game, msg.playerId)) return;
  if (!isPlayerTurn(game, msg.playerId)) return;
  if (game.phase !== PHASE_AWAITING_ROLL) return;

  const diceValue = rollDice();
  game.last_roll = diceValue;
  game.phase = PHASE_AWAITING_MOVE;

  if (!hasValidMoves(game, game.player_index, diceValue)) {
    logEvent(game, `No valid moves available. Turn skipped.`, broadcast);
    advanceTurn(game);
  }

  broadcast({ type: "dice_roll", dice: diceValue });
  broadcast({ type: "game_info", game: game, s: state });
}

/**
 * Handle marble movement
 */
function handleMoveMarble(msg, state, ws, broadcast) {
  if (!msg.playerId || !msg.gameCode || msg.marbleIndex === undefined || msg.destination === undefined) return;
  if (!state.players[msg.playerId]) return;
  if (!state.games[msg.gameCode]) return;

  const game = state.games[msg.gameCode];
  
  if (!isPlayerInGame(game, msg.playerId)) return;
  if (!isPlayerTurn(game, msg.playerId)) return;
  if (game.phase !== PHASE_AWAITING_MOVE) return;
  if (!game.last_roll) return;

  const currentPlayer = game.players[game.player_index];
  const marbleIndex = msg.marbleIndex;
  const destination = msg.destination;

  if (!isValidMarbleIndex(marbleIndex, currentPlayer)) return;

  const currentPos = currentPlayer.marbles[marbleIndex];

  // Get all valid destinations and check if the requested destination is valid
  const validDestinations = getValidDestinations(
    currentPos,
    game.last_roll,
    game.player_index,
    currentPlayer.marbles,
    marbleIndex
  );

  if (!validDestinations.includes(destination)) return;

  currentPlayer.marbles[marbleIndex] = destination;

  logEvent(game, `${state.players[msg.playerId].name} moved marble to position ${destination}`, broadcast);

  // Check for collisions with other players
  for (let i = 0; i < game.players.length; i++) {
    if (i !== game.player_index) {
      const otherPlayer = game.players[i];
      for (let j = 0; j < otherPlayer.marbles.length; j++) {
        if (otherPlayer.marbles[j] === destination && !isHomePosition(destination, i)) {
          const homePos = getHomePositions(i)[j];
          otherPlayer.marbles[j] = homePos;
          const otherPlayerName = state.players[otherPlayer.id]?.name || 'Player';
          logEvent(game, `${otherPlayerName}'s marble was sent home!`, broadcast);
        }
      }
    }
  }

  // Handle turn advancement
  if (game.last_roll === 6) {
    logEvent(game, `${state.players[msg.playerId].name} rolled a 6 and gets another turn!`, broadcast);
    game.phase = PHASE_AWAITING_ROLL;
    game.last_roll = null;
  } else {
    advanceTurn(game);
  }

  broadcast({ type: "game_info", game: game, s: state });
}

/**
 * Route incoming message to appropriate handler
 */
function handleMessage(msg, state, ws, send, broadcast) {
  switch (msg.type) {
    case "identify":
      handleIdentify(msg, state, ws, send);
      break;
    case "new_game":
      handleNewGame(msg, state, ws, send);
      break;
    case "join_game":
      handleJoinGame(msg, state, ws, send);
      break;
    case "heartbeat":
      handleHeartbeat(msg, state, ws, send);
      break;
    case "roll_dice":
      handleRollDice(msg, state, ws, broadcast);
      break;
    case "move_marble":
      handleMoveMarble(msg, state, ws, broadcast);
      break;
    default:
      // Unknown message type - ignore
      break;
  }
}

module.exports = {
  handleMessage,
  handleIdentify,
  handleNewGame,
  handleJoinGame,
  handleHeartbeat,
  handleRollDice,
  handleMoveMarble
};
