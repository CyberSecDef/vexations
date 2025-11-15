/* eslint-disable no-console */
const path = require("path");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT) || 5000;
const PING_INTERVAL_MS = 20_000;

// Star and center space positions on the path
const STAR_POSITIONS = [7, 21, 35, 49];
const CENTER_POSITION = 999;

const token8 = () => {
  const t = Date.now(); // current time in ms
  const r = Math.floor(Math.random() * 0xffffff); // random 24-bit salt
  const mix = (t ^ r).toString(36).toUpperCase(); // xor + base36
  return (mix + Math.random().toString(36).substr(2, 8))
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") // strip weirds
    .slice(0, 8); // keep 8 chars
};

// Game helper functions: use shared implementation to avoid duplication
// Import the canonical rules from src/shared so server and client stay in sync
const {
  getHomePositions,
  getStartPosition,
  isHomePosition,
  canMoveFromHome,
  hasValidMoves,
  wouldBlockSelf,
  isStarPosition,
  getValidDestinations,
  rollDice
} = require('./src/shared/gameRules');

// Use canonical turn advancement logic from server game modules
const { advanceTurn } = require('./src/server/game/turnManager');
const { sanitizeName, send } = require('./src/server/utils/helpers');

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
const { broadcast, setWebSocketServer } = require('./src/server/core/broadcast');
const { logEvent } = require('./src/server/utils/logger');

// WS connection handling
wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  send(ws, { type: "hello", serverTime: Date.now() });
  
  // ensure shared broadcast helper knows about this wss instance
  try { setWebSocketServer(wss); } catch (e) { /* noop */ }

  ws.on("message", (raw) => {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch (e) {
      return;
    }

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
          logEvent(game, `No valid moves available. Turn skipped.`, broadcast);
          advanceTurn(game);
        }
        
        broadcast({ type: "dice_roll", dice: diceValue });
        broadcast({ type: "game_info", game: game, s: state });

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
        
  logEvent(moveGame, `${state.players[msg.playerId].name} moved marble to position ${destination}`, broadcast);
        
        // Check for collisions with other players
        for (let i = 0; i < moveGame.players.length; i++) {
          if (i !== moveGame.player_index) {
            const otherPlayer = moveGame.players[i];
            for (let j = 0; j < otherPlayer.marbles.length; j++) {
              if (otherPlayer.marbles[j] === destination && !isHomePosition(destination, i)) {
                const homePos = getHomePositions(i)[j];
                otherPlayer.marbles[j] = homePos;
                const otherPlayerName = state.players[otherPlayer.id]?.name || 'Player';
                logEvent(moveGame, `${otherPlayerName}'s marble was sent home!`, broadcast);
              }
            }
          }
        }
        
        // Handle turn advancement
        if (moveGame.last_roll === 6) {
          logEvent(moveGame, `${state.players[msg.playerId].name} rolled a 6 and gets another turn!`, broadcast);
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

        const newPlayerIndex = state.games[msg.gameCode].players.length;
        let p = {
          id: msg.playerId,
          marbles: getHomePositions(newPlayerIndex),
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
