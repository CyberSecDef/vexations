const { getHomePositions, getStartPosition, isHomePosition, getValidDestinations, hasValidMoves, rollDice } = require('../../shared/gameRules');
const { PATH_LENGTH, BOT_THINK_MIN_MS, BOT_THINK_MAX_MS, CENTER_POSITION } = require('../../shared/constants');
const { advanceTurn } = require('../game/turnManager');
const { logEvent } = require('../utils/logger');
const { checkForWinner } = require('../game/winner');

function isBotPlayer(state, playerId) {
  return !!(state.players[playerId] && state.players[playerId].isBot);
}

function chooseBotMove(game, state) {
  const pIndex = game.player_index;
  const player = game.players[pIndex];

  const candidates = [];

  const pathLen = typeof PATH_LENGTH === 'number' ? PATH_LENGTH : 56;
  const startPos = getStartPosition(pIndex);

  function progressScore(pos) {
    if (pos === CENTER_POSITION) return -10000;
    if (typeof pos === 'number' && pos >= pathLen && pos < pathLen + 16) {
      return pathLen + (pos - pathLen);
    }
    if (typeof pos === 'number' && pos >= 0 && pos < pathLen) {
      const rel = (pos - startPos + pathLen) % pathLen;
      return rel;
    }
    return 0;
  }

  for (let mi = 0; mi < player.marbles.length; mi++) {
    const cur = player.marbles[mi];
    const valids = getValidDestinations(cur, game.last_roll, pIndex, player.marbles, mi);
    valids.forEach(dest => {
      let captures = false;
      for (let otherI = 0; otherI < game.players.length; otherI++) {
        if (otherI === pIndex) continue;
        const other = game.players[otherI];
        for (let oj = 0; oj < other.marbles.length; oj++) {
          if (other.marbles[oj] === dest && !isHomePosition(dest, otherI)) captures = true;
        }
      }
      const score = (captures ? 100000 : 0) + progressScore(dest);
      candidates.push({ marbleIndex: mi, destination: dest, captures, score });
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || a.marbleIndex - b.marbleIndex);
  return candidates[0];
}

async function runBotTurnIfNeeded(game, state, broadcast) {
  if (!game || !game.players || game.players.length === 0) return;
  const pIndex = game.player_index;
  const pid = game.players[pIndex].id;
  if (!isBotPlayer(state, pid)) return;
  if (game._botRunning) return;
  game._botRunning = true;

  try {
    // think time
    const think = BOT_THINK_MIN_MS + Math.floor(Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS + 1));
    await new Promise(r => setTimeout(r, think));

    if (game.phase === 'awaiting_roll') {
      const diceValue = rollDice();
      game.last_roll = diceValue;
      game.phase = 'awaiting_move';
      broadcast({ type: 'dice_roll', dice: diceValue });
      broadcast({ type: 'game_info', game: game, s: state });

      if (!hasValidMoves(game, pIndex, diceValue)) {
        logEvent(game, `Bot ${state.players[pid].name} has no valid moves. Turn skipped.`, broadcast);
        advanceTurn(game);
        broadcast({ type: 'game_info', game: game, s: state });
        game._botRunning = false;
        return;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    if (game.phase === 'awaiting_move') {
      const choice = chooseBotMove(game, state);
      if (!choice) {
        logEvent(game, `Bot ${state.players[pid].name} found no valid choice. Turn skipped.`, broadcast);
        advanceTurn(game);
        broadcast({ type: 'game_info', game: game, s: state });
        game._botRunning = false;
        return;
      }

      const playerObj = game.players[pIndex];
      const validDests = getValidDestinations(playerObj.marbles[choice.marbleIndex], game.last_roll, pIndex, playerObj.marbles, choice.marbleIndex);
      if (!validDests.includes(choice.destination)) {
        advanceTurn(game);
        broadcast({ type: 'game_info', game: game, s: state });
        game._botRunning = false;
        return;
      }

      playerObj.marbles[choice.marbleIndex] = choice.destination;
      logEvent(game, `${state.players[pid].name} (bot) moved marble to position ${choice.destination}`, broadcast);

      for (let i = 0; i < game.players.length; i++) {
        if (i === pIndex) continue;
        const other = game.players[i];
        for (let j = 0; j < other.marbles.length; j++) {
          if (other.marbles[j] === choice.destination && !isHomePosition(choice.destination, i)) {
            const homePos = getHomePositions(i)[j];
            other.marbles[j] = homePos;
            const otherName = state.players[other.id]?.name || 'Player';
            logEvent(game, `${otherName}'s marble was sent home!`, broadcast);
          }
        }
      }

      // Check for winner after move and collisions
      const winner = checkForWinner(game, state, broadcast);
      if (winner) {
        game._botRunning = false;
        return;
      }

      if (game.last_roll === 6) {
        logEvent(game, `${state.players[pid].name} rolled a 6 and gets another turn!`, broadcast);
        game.phase = 'awaiting_roll';
        game.last_roll = null;
      } else {
        advanceTurn(game);
      }

      broadcast({ type: 'game_info', game: game, s: state });

      if (isBotPlayer(state, game.players[game.player_index].id)) {
        setTimeout(() => runBotTurnIfNeeded(game, state, broadcast).catch(() => {}), 250);
      }
    }
  } finally {
    game._botRunning = false;
  }
}

function startPeriodicScanner(state, broadcast) {
  setInterval(() => {
    for (const code in state.games) {
      const g = state.games[code];
      if (!g) continue;
      const pIndex = g.player_index;
      if (!g.players || !g.players[pIndex]) continue;
      const pid = g.players[pIndex].id;
      if (isBotPlayer(state, pid)) {
        // fire-and-forget
        runBotTurnIfNeeded(g, state, broadcast).catch(() => {});
      }
    }
  }, 500);
}

module.exports = {
  chooseBotMove,
  runBotTurnIfNeeded,
  startPeriodicScanner,
};
