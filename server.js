/* eslint-disable no-console */
const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

// Import configuration and modules
const { HOST, PORT, PING_INTERVAL_MS } = require("./src/config/constants");
const { handleMessage } = require("./src/websocket/handlers");
const { logEvent } = require("./src/game/state");
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5000;
const PING_INTERVAL_MS = 20_000;

// Star and center space positions on the path
const STAR_POSITIONS = [7, 21, 35, 49];
const BOT_THINK_MIN_MS = 250;
const BOT_THINK_MAX_MS = 850;
const CENTER_POSITION = 999;
const BOT_NAMES = ["Echo", "Data", "Bender", "Marvin"];

const token8 = () => {
  const t = Date.now(); // current time in ms
  const r = Math.floor(Math.random() * 0xffffff); // random 24-bit salt
  const mix = (t ^ r).toString(36).toUpperCase(); // xor + base36
  return (mix + Math.random().toString(36).substr(2, 8))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // strip weirds
    .slice(0, 8); // keep 8 chars
};

const rollDice = () => {
  return Math.floor(Math.random() * 6) + 1;
};

// Game helper functions
const getHomePositions = (playerIndex) => {
  const homes = [
    [101, 102, 103, 104],
    [201, 202, 203, 204],
    [301, 302, 303, 304],
    [401, 402, 403, 404]
  ];
  return homes[playerIndex] || [];
};

const getStartPosition = (playerIndex) => {
  return [0, 14, 28, 42][playerIndex] || 0;
};

const isHomePosition = (position, playerIndex) => {
  return getHomePositions(playerIndex).includes(position);
};

function isBotPlayer(player) {
  return player && player.robot === true;
}

// Compute linear advancement from currentPos to destPos for favoring "move as far as possible".
// If currentPos is a home position (>=100), compute distance from the player's start position.
function stepsAdvance(currentPos, destPos, playerIndex) {
  if (currentPos === CENTER_POSITION) {
    // From center, stepping to a star (only happens when roll === 1), treat progress as 0.. give some modest credit
    return 1;
  }
  if (currentPos >= 100) {
    // coming out of home to start: measure distance from start to dest
    const start = getStartPosition(playerIndex);
    return ((destPos - start + 56) % 56);
  }
  // normal on-path distance (wrap-aware)
  return ((destPos - currentPos + 56) % 56);
}

function scoreDestination(game, playerIndex, currentPos, destPos) {
  let score = 0;

  // Primary: distance advanced (bigger is better)
  const adv = stepsAdvance(currentPos, destPos, playerIndex);
  score += adv * 50;

  // Big bonus for capturing opponent marble(s) at the destination (unless dest is home)
  for (let i = 0; i < game.players.length; i++) {
    if (i === playerIndex) continue;
    const other = game.players[i];
    if (!other || !other.marbles) continue;
    for (let m = 0; m < other.marbles.length; m++) {
      const om = other.marbles[m];
      if (om === destPos && !isHomePosition(destPos, i)) {
        score += 2000; // very high priority to capture
      }
    }
  }

  // Star landing is desirable (prefer star road)
  if (isStarPosition(destPos)) score += 300;

  // Prefer moving marbles that are already out (if exactly one marble out we strongly prefer moving that one)
  const myMarbles = game.players[playerIndex].marbles || [];
  const marblesOut = myMarbles.filter(p => p < 100).length;
  if (marblesOut === 1 && currentPos < 100) {
    score += 200; // helps prefer moving the single out marble
  }

  // Slight penalty for moving into CENTER unless we've allowed center (handled externally too)
  if (destPos === CENTER_POSITION) score -= 500;

  // Break ties with a small random factor
  score += Math.random() * 10;

  return score;
}

// Returns { marbleIndex, destination } or null
function computeBestBotMove(game, playerIndex) {
  const player = game.players[playerIndex];
  if (!player) return null;
  if (game.phase !== 'awaiting_move' || !game.last_roll) return null;

  const diceValue = game.last_roll;
  const myMarbles = player.marbles || [];
  const marblesOut = myMarbles.filter(p => p < 100).length;

  let best = null;
  let bestScore = -Infinity;

  for (let mi = 0; mi < myMarbles.length; mi++) {
    const pos = myMarbles[mi];
    const validDests = getValidDestinations(pos, diceValue, playerIndex, myMarbles, mi);
    if (!validDests || validDests.length === 0) continue;

    for (const dest of validDests) {
      // Center rule: if only one marble out, ignore center
      if (dest === CENTER_POSITION && marblesOut <= 1) continue;

      // Do not allow moving onto own marble (getValidDestinations already filters wouldBlockSelf, but double-check)
      if (wouldBlockSelf(myMarbles, mi, dest)) continue;

      const score = scoreDestination(game, playerIndex, pos, dest);
      if (score > bestScore) {
        bestScore = score;
        best = { marbleIndex: mi, destination: dest };
      }
    }
  }

  return best;
}

const canMoveFromHome = (diceValue) => {
  return diceValue === 1 || diceValue === 6;
};

const hasValidMoves = (game, playerIndex, diceValue) => {
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
};

const wouldBlockSelf = (marbles, movingIndex, targetPosition) => {
  for (let i = 0; i < marbles.length; i++) {
    if (i !== movingIndex && marbles[i] === targetPosition) {
      return true;
    }
  }
  return false;
};

const advanceTurn = (game) => {
  game.player_index = (game.player_index + 1) % game.players.length;
  game.phase = 'awaiting_roll';
  game.last_roll = null;
  scheduleBotAction(game);
};



const isStarPosition = (position) => {
  return STAR_POSITIONS.includes(position);
};

const botTimers = {};

function scheduleBotAction(game) {
  if (!game) return;
  const currentPlayer = game.players[game.player_index];
  if (!isBotPlayer(currentPlayer)) return;

  const code = game.code;
  if (botTimers[code]) {
    clearTimeout(botTimers[code]);
    botTimers[code] = null;
  }
  const delay = BOT_THINK_MIN_MS + Math.floor(Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS));
  botTimers[code] = setTimeout(() => runBotTurn(game), delay);
}

function runBotTurn(game) {
  if (!game) return;
  const idx = game.player_index;
  const player = game.players[idx];
  if (!isBotPlayer(player)) return;

  // If awaiting roll -> auto-roll
  if (game.phase === 'awaiting_roll') {
    const dice = rollDice(); // server's rollDice() returns numeric
    game.last_roll = dice;
    game.phase = 'awaiting_move';
    logEvent(game, `${player.name} (robot) rolled a ${dice}`);
    broadcast({ type: "dice_roll", dice, robot: true });
    broadcast({ type: "game_info", game, s: state });

    // schedule move
    scheduleBotAction(game);
    return;
  }

  // If awaiting move -> compute and perform
  if (game.phase === 'awaiting_move') {
    const choice = computeBestBotMove(game, idx);
    if (!choice) {
      // skip turn
      logEvent(game, `${player.name} (robot) has no valid moves`);
      advanceTurn(game);
      broadcast({ type: "game_info", game, s: state });
      // schedule next player (could be bot)
      scheduleBotAction(game);
      return;
    }

    const mi = choice.marbleIndex;
    const dest = choice.destination;
    // apply move
    player.marbles[mi] = dest;
    logEvent(game, `${player.name} (robot) moved marble to ${dest}`);

    // collisions - copy the same logic you already have in move_marble
    for (let i = 0; i < game.players.length; i++) {
      if (i === idx) continue;
      const other = game.players[i];
      for (let j = 0; j < other.marbles.length; j++) {
        if (other.marbles[j] === dest && !isHomePosition(dest, i)) {
          const homePos = getHomePositions(i)[j];
          other.marbles[j] = homePos;
          const otherName = state.players[other.id]?.name || 'Player';
          logEvent(game, `${otherName}'s marble was sent home!`);
        }
      }
    }

    // handle extra turn on 6
    if (game.last_roll === 6) {
      logEvent(game, `${player.name} (robot) rolled a 6 and gets another turn`);
      game.phase = 'awaiting_roll';
      game.last_roll = null;
      broadcast({ type: "game_info", game, s: state });
      scheduleBotAction(game);
      return;
    } else {
      advanceTurn(game);
      broadcast({ type: "game_info", game, s: state });
      scheduleBotAction(game);
      return;
    }
  }
}





// Calculate all valid destinations from a position with given steps
// Returns array of possible destination positions (only positions using EXACT steps)
// Star hopping only works if you START on a star (not if you pass through one)
// center entry must be exact.  center exit is only on dice roll of 1
const getValidDestinations = (currentPosition, steps, playerIndex, allMarbles, movingIndex) => {
  // If currently in center: only exit on exact roll 1 to any star position
  if (currentPosition === CENTER_POSITION) {
    if (steps === 1) {
      // return all star positions you can move to (not blocked by self)
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
    const nextPos = (pos + 1) % 56;
    // do not allow passing through your own marble - skip this step if blocked
    if (!wouldBlockSelf(allMarbles, movingIndex, nextPos)) {
      queue.push({ pos: nextPos, stepsLeft: stepsLeft - 1, visitedStars: new Set(visitedStars) });
    }

    // If nextPos is a STAR, you can optionally move INTO the CENTER (distance 1 from that star)
    // This models the center being adjacent to the star squares.
    if (isStarPosition(nextPos)) {
      // moving from a star into the center: only allow if center isn't occupied by own marble
      if (!wouldBlockSelf(allMarbles, movingIndex, CENTER_POSITION)) {
        queue.push({ pos: CENTER_POSITION, stepsLeft: stepsLeft - 1, visitedStars: new Set(visitedStars) });
      }
    }

    // Star teleporting: only allowed if we START on a star (not if we pass through)
    if (pos === currentPosition && isStarPosition(pos)) {
      for (const starPos of STAR_POSITIONS) {
        if (starPos !== pos && !visitedStars.has(starPos)) {
          // don't teleport to a star occupied by your own marble
          if (wouldBlockSelf(allMarbles, movingIndex, starPos)) continue;
          const newVisited = new Set(visitedStars);
          newVisited.add(starPos);
          queue.push({ pos: starPos, stepsLeft: stepsLeft - 1, visitedStars: newVisited });
        }
      }
    }
  }

  return Array.from(reachable);
};

// Express app setup
const app = express();

// Cache control middleware
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

// Game state
let state = {
  players: {}, // playerId => { id, name, class, score, connected, lastSeen }
  games: {}, // gameCode => {players, dice, status, events}
};

// Server + WS setup
const server = http.createServer(app);

let wss = null;

/**
 * Broadcast message to all connected clients
 * @param {Object} obj - Object to broadcast
 */
function broadcast(obj) {
  // No-op if wss isn't initialized yet (e.g., during boot logging)
  if (!wss || wss.clients.size === 0) return;
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

/**
 * Create full snapshot of server state
 * @returns {Object} Snapshot object
 */
function fullSnapshot() {
  // Provide the minimum to recreate UI
  return {
    type: "snapshot",
  };
}

/**
 * Send message to specific WebSocket client
 * @param {WebSocket} ws - WebSocket client
 * @param {Object} obj - Object to send
 */
function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    /* noop */
  }
}


// WebSocket connection handling
// create a bot id
function makeBotId() {
  return `bot-${token8().toLowerCase()}`;
}

// create a minimal state.players entry for a bot (name, connected false)
function registerBotState(botId, name) {
  state.players[botId] = { id: botId, name, connected: false, lastSeen: Date.now() };
}


function chooseBotName(game) {
  // Collect names already used by players in this game
  const used = new Set();
  for (const p of game.players || []) {
    // look in state.players for the canonical name if available
    const st = state.players[p.id];
    if (st && st.name) used.add(st.name);
    else if (p.name) used.add(p.name);
  }

  // Pick the first available name from BOT_NAMES
  for (const name of BOT_NAMES) {
    if (!used.has(name)) return name;
  }

  // All used: fallback - pick a random name (optionally append suffix)
  const chosen = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  // Optionally, to avoid confusion, append a short suffix:
  // return `${chosen}-${Math.floor(Math.random()*1000)}`;
  return chosen;
}

// create and push one bot into game (at game's current length index)
function addBotToGame(game) {
  const idx = game.players.length;
  const botId = makeBotId();
  const botName = chooseBotName(game);
  const botPlayer = {
    id: botId,
    name: botName,
    marbles: getHomePositions(idx),
    robot: true,
  };
  game.players.push(botPlayer);
  registerBotState(botId, botName);
  logEvent(game, `${botName} joined the game`);
  scheduleBotAction(game);
  return botPlayer;
}

// Fill game.players until there are 4 players (no-op if >=4)
function fillGameWithBots(game) {
  if (!game) return;
  while (game.players.length < 4) {
    addBotToGame(game);
  }
  // broadcast and schedule bots if appropriate
  broadcast({ type: "game_info", game: game, s: state });
  scheduleBotAction(game);
}

// Remap home codes for players after removal index
function remapHomesAfterRemoval(game, removedIdx) {
  // For each player that moved left (oldIdx -> newIdx)
  for (let newIdx = removedIdx; newIdx < game.players.length; newIdx++) {
    const oldIdx = newIdx + 1; // before splice, they were one to the right
    const oldHomes = getHomePositions(oldIdx);
    const newHomes = getHomePositions(newIdx);
    const marbles = game.players[newIdx].marbles;
    for (let m = 0; m < marbles.length; m++) {
      const val = marbles[m];
      const pos = oldHomes.indexOf(val);
      if (pos !== -1) {
        marbles[m] = newHomes[pos];
      }
    }
  }
}

function removeRandomBot(game) {
  if (!game) return null;
  // collect bot indices
  const botIndices = [];
  for (let i = 0; i < game.players.length; i++) {
    if (game.players[i].robot) botIndices.push(i);
  }
  if (botIndices.length === 0) return null;

  const idx = botIndices[Math.floor(Math.random() * botIndices.length)];
  const bot = game.players[idx];
  const botId = bot.id;
  const botName = state.players[botId]?.name || botId;

  // remove the bot from game.players
  game.players.splice(idx, 1);

  // clean up state.players entry for the bot (optional)
  if (state.players[botId]) delete state.players[botId];

  // remap homes for players to the right of removed index
  remapHomesAfterRemoval(game, idx);

  // adjust game.player_index so it still points to the correct person
  if (idx < game.player_index) {
    game.player_index = Math.max(0, game.player_index - 1);
  } else if (idx === game.player_index) {
    // We removed the player whose turn it was. Keep the index the same
    // so the next player (who shifted into this index) becomes active.
    // If that index is now out of bounds (rare), wrap to 0.
    if (game.player_index >= game.players.length) game.player_index = 0;
  }

  logEvent(game, `${botName} was removed to make room for a real player`);

  // clear bot timers for safety and reschedule
  if (botTimers[game.code]) {
    clearTimeout(botTimers[game.code]);
    botTimers[game.code] = null;
  }
  scheduleBotAction(game);

  // broadcast updated game state
  broadcast({ type: "game_info", game: game, s: state });

  return botId;
}

// WS connection handling
wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  send(ws, { type: "hello", serverTime: Date.now() });
  send(ws, fullSnapshot());

  ws.on("message", (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

    // Broadcast wrapper to also log events
    const broadcastWithLog = (obj) => {
      if (obj.type === "eventLog") {
        broadcast(obj);
      } else {
        broadcast(obj);
      }
    };
    switch (msg.type) {
      case "roll_dice":
        if (!msg.playerId || !msg.gameCode) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;
        const game = state.games[msg.gameCode];
        if (
          game.players.filter((e, i) => {
            return e.id == msg.playerId;
          }).length <= 0
        )
          return;
        if (game.players[game.player_index].id != msg.playerId) return;
        if (game.phase !== 'awaiting_roll') return;

        const diceValue = rollDice();
        game.last_roll = diceValue;
        game.phase = 'awaiting_move';

        if (!hasValidMoves(game, game.player_index, diceValue)) {
          advanceTurn(game);
        }

        broadcast({ type: "dice_roll", dice: diceValue, robot: false });
        broadcast({ type: "game_info", game: game, s: state });
        scheduleBotAction(game);
        break;
      case "move_marble":
        if (!msg.playerId || !msg.gameCode || msg.marbleIndex === undefined || msg.destination === undefined) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;

        const moveGame = state.games[msg.gameCode];
        if (moveGame.players.filter(e => e.id == msg.playerId).length <= 0) return;
        if (moveGame.players[moveGame.player_index].id != msg.playerId) return;
        if (moveGame.phase !== 'awaiting_move') return;
        if (!moveGame.last_roll) return;

        const currentPlayer = moveGame.players[moveGame.player_index];
        const marbleIndex = msg.marbleIndex;
        const destination = msg.destination;

        if (marbleIndex < 0 || marbleIndex >= currentPlayer.marbles.length) return;

        const currentPos = currentPlayer.marbles[marbleIndex];

        // Get all valid destinations and check if the requested destination is valid
        const validDestinations = getValidDestinations(
          currentPos,
          moveGame.last_roll,
          moveGame.player_index,
          currentPlayer.marbles,
          marbleIndex
        );

        if (!validDestinations.includes(destination)) return;

        currentPlayer.marbles[marbleIndex] = destination;

        logEvent(moveGame, `${state.players[msg.playerId].name} moved marble to position ${destination}`);

        // Check for collisions with other players
        for (let i = 0; i < moveGame.players.length; i++) {
          if (i !== moveGame.player_index) {
            const otherPlayer = moveGame.players[i];
            for (let j = 0; j < otherPlayer.marbles.length; j++) {
              if (otherPlayer.marbles[j] === destination && !isHomePosition(destination, i)) {
                const homePos = getHomePositions(i)[j];
                otherPlayer.marbles[j] = homePos;
                const otherPlayerName = state.players[otherPlayer.id]?.name || 'Player';
                logEvent(moveGame, `${otherPlayerName}'s marble was sent home!`);
              }
            }
          }
        }

        // Handle turn advancement
        if (moveGame.last_roll === 6) {
          logEvent(moveGame, `${state.players[msg.playerId].name} rolled a 6 and gets another turn!`);
          moveGame.phase = 'awaiting_roll';
          moveGame.last_roll = null;
        } else {
          advanceTurn(moveGame);
        }

        broadcast({ type: "game_info", game: moveGame, s: state });
        scheduleBotAction(moveGame);
        break;
      case "heartbeat":
        if (!msg.playerId || !msg.gameCode) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;
        if (!state.games[msg.gameCode].players) return;
        if (state.games[msg.gameCode].players.length == 0) return;

        send(ws, {
          type: "game_info",
          game: state.games[msg.gameCode],
          s: state,
        });
        break;
      case "join_game":
        if (!msg.playerId || !msg.gameCode) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;
        if (!state.games[msg.gameCode].players) {
          state.games[msg.gameCode].players = [];
        }

        // If game is full, try to boot a bot to make room
        if (state.games[msg.gameCode].players.length >= 4) {
          const removed = removeRandomBot(state.games[msg.gameCode]);
          if (!removed && state.games[msg.gameCode].players.length >= 4) {
            // No bots to remove and still full -> reject join
            return;
          }
        }

        const newPlayerIndex = state.games[msg.gameCode].players.length;
        let p = {
          id: msg.playerId,
          marbles: getHomePositions(newPlayerIndex),
        };
        state.games[msg.gameCode].players.push(p);

        // Ensure we top up to 4 players with bots (if you want the room filled automatically)
        fillGameWithBots(state.games[msg.gameCode]);
        scheduleBotAction(state.games[msg.gameCode]);
        send(ws, {
          type: "game_info",
          game: state.games[msg.gameCode],
          s: state,
        });
        break;
      case "new_game":
        let gameCode = token8();
        let g = {};
        g.code = gameCode;
        g.players = [];
        g.player_index = 0;
        g.phase = 'awaiting_roll';
        g.last_roll = null;
        g.event_log = [];
        state.games[gameCode] = g;
        fillGameWithBots(state.games[gameCode]);

        send(ws, { type: "game_info", game: state.games[gameCode], s: state });
        break;
      case "identify":
        if (!msg.playerId || !msg.playerName) {
          return;
        }
        if (!state.players[msg.playerId]) {
          let p = {};
          p.id = msg.playerId;
          p.name = sanitizeName(msg.playerName);
          state.players[msg.playerId] = p;
        }
        state.players[msg.playerId].connected = true;
        state.players[msg.playerId].lastSeen = Date.now();

        send(ws, {
          type: "identified",
          player: state.players[msg.playerId],
          s: state,
        });
        break;
    }

    // Route message to handler
    handleMessage(msg, state, ws, send, broadcastWithLog);
  });

  ws.on("close", () => {
    // Connection closed - could track disconnections here

  });
});

// Liveness ping to terminate dead sockets
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      try {
        ws.terminate();
      } catch (e) {
        // Ignore termination errors
      }
      } catch (e) { }
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {
      // Ignore ping errors
    }
    } catch (e) { }
  }
}, PING_INTERVAL_MS);

// Start server
server.listen(PORT, () => {
  console.log(`✅ Vex game server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  clearInterval(interval);
  process.exit(0);
});
