/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const WebSocket = require("ws");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5000;
const PING_INTERVAL_MS = 20_000;

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

const canMoveFromHome = (diceValue) => {
  return diceValue === 1 || diceValue === 6;
};

const getNextPosition = (currentPosition, steps, playerIndex) => {
  if (isHomePosition(currentPosition, playerIndex)) {
    if (canMoveFromHome(steps)) {
      return getStartPosition(playerIndex);
    }
    return null;
  }
  
  const nextPos = (currentPosition + steps) % 56;
  return nextPos;
};

const hasValidMoves = (game, playerIndex, diceValue) => {
  const player = game.players[playerIndex];
  if (!player) return false;
  
  for (let i = 0; i < player.marbles.length; i++) {
    const pos = player.marbles[i];
    
    if (isHomePosition(pos, playerIndex)) {
      if (canMoveFromHome(diceValue)) return true;
    } else {
      const newPos = getNextPosition(pos, diceValue, playerIndex);
      if (newPos !== null && !wouldBlockSelf(player.marbles, i, newPos)) {
        return true;
      }
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
};

const app = express();

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

// send to everyone
function broadcast(obj) {
  // No-op if wss isn't initialized yet (e.g., during boot logging)
  if (!wss || wss.clients.size === 0) return;
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function fullSnapshot() {
  // Provide the minimum to recreate UI
  return {
    type: "snapshot",
  };
}

function send(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {
    /* noop */
  }
}

function sanitizeName(name) {
  if (!name || typeof name !== "string") return "Player";
  return name.trim().slice(0, 16) || "Player";
}

function logEvent(game, message) {
  const entry = { ts: Date.now(), message };
  if (!game.event_log) game.event_log = [];
  game.event_log.push(entry);
  if (game.event_log.length > 100) game.event_log.shift();
  broadcast({ type: "eventLog", event: entry });
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
    const now = Date.now();

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
        
        logEvent(game, `${state.players[msg.playerId].name} rolled a ${diceValue}`);
        
        if (!hasValidMoves(game, game.player_index, diceValue)) {
          logEvent(game, `No valid moves available. Turn skipped.`);
          advanceTurn(game);
        }
        
        broadcast({ type: "dice_roll", dice: diceValue });
        broadcast({ type: "game_info", game: game, s: state });

        break;
      case "move_marble":
        if (!msg.playerId || !msg.gameCode || msg.marbleIndex === undefined) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;
        
        const moveGame = state.games[msg.gameCode];
        if (moveGame.players.filter(e => e.id == msg.playerId).length <= 0) return;
        if (moveGame.players[moveGame.player_index].id != msg.playerId) return;
        if (moveGame.phase !== 'awaiting_move') return;
        if (!moveGame.last_roll) return;
        
        const currentPlayer = moveGame.players[moveGame.player_index];
        const marbleIndex = msg.marbleIndex;
        
        if (marbleIndex < 0 || marbleIndex >= currentPlayer.marbles.length) return;
        
        const currentPos = currentPlayer.marbles[marbleIndex];
        const newPos = getNextPosition(currentPos, moveGame.last_roll, moveGame.player_index);
        
        if (newPos === null) return;
        if (wouldBlockSelf(currentPlayer.marbles, marbleIndex, newPos)) return;
        
        currentPlayer.marbles[marbleIndex] = newPos;
        
        logEvent(moveGame, `${state.players[msg.playerId].name} moved marble to position ${newPos}`);
        
        // Check for collisions with other players
        for (let i = 0; i < moveGame.players.length; i++) {
          if (i !== moveGame.player_index) {
            const otherPlayer = moveGame.players[i];
            for (let j = 0; j < otherPlayer.marbles.length; j++) {
              if (otherPlayer.marbles[j] === newPos && !isHomePosition(newPos, i)) {
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
        break;
      case "heartbeat":
        if (!msg.playerId || !msg.gameCode) return;
        if (!state.players[msg.playerId]) return;
        if (!state.games[msg.gameCode]) return;
        if (!state.games[msg.gameCode].players) return;
        if (state.games[msg.gameCode].players.length == 0) return;

        /*
        if (state.games[msg.gameCode].players[0].marbles){
          state.games[msg.gameCode].players[0].marbles[0]++
        }
        */

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
        if (state.games[msg.gameCode].players.length >= 4) return;

        let p = {
          id: msg.playerId,
          marbles: [10, 101, 102, 103],
        };
        state.games[msg.gameCode].players.push(p);

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

    return;
  });

  ws.on("close", () => {
    if (ws.playerId) {
      const p = state.players.get(ws.playerId);
      if (p) {
        p.connected = false;
        p.lastSeen = Date.now();
      }
    }
  });
});

// Liveness ping to terminate dead sockets
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      try {
        ws.terminate();
      } catch (e) {}
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch (e) {}
  }
}, PING_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`✅ Vex game server listening on http://${HOST}:${PORT}`);
});

process.on("SIGINT", () => {
  clearInterval(interval);
  process.exit(0);
});
