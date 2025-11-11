/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');

const HOST = "0.0.0.0"
const PORT = 8010;
const PING_INTERVAL_MS = 20_000;

const token8 = () => {
  const t = Date.now();                          // current time in ms
  const r = Math.floor(Math.random() * 0xFFFFFF); // random 24-bit salt
  const mix = (t ^ r).toString(36).toUpperCase(); // xor + base36
  return (mix + Math.random().toString(36).substr(2, 8)).toUpperCase()
    .replace(/[^A-Z0-9]/g, '')                   // strip weirds
    .slice(0, 8);                                // keep 8 chars
};

const rollDice = () => {
  return Math.floor(Math.random() * 6) + 1;
};

const app = express();
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));

// Game state
let state = {
  players: {},           // playerId => { id, name, class, score, connected, lastSeen }
  games: {},             // gameCode => {players, dice, status, events}
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
    type: 'snapshot'
  };
}

function send(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch (e) { /* noop */ }
}





function sanitizeName(name) {
  if (!name || typeof name !== 'string') return 'Player';
  return name.trim().slice(0, 16) || 'Player';
}

function logEvent(game, message) {
  const entry = { ts: Date.now(), message };
  //state.games.get(game).eventLog.push(entry);
  //if (state.eventLog.length > 500) state.eventLog.shift();
  broadcast({ type: 'eventLog', event: entry });
}


// WS connection handling
wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { type: 'hello', serverTime: Date.now() });
  send(ws, fullSnapshot());

  ws.on('message', (raw) => {
    let msg;

    try { msg = JSON.parse(raw); } catch (e) { return; }
    const now = Date.now();

    switch (msg.type) {
      case "roll_dice":
        if (!msg.playerId || !msg.gameCode) return
        if (!state.players[msg.playerId]) return
        if (!state.games[msg.gameCode]) return
        if (state.games[msg.gameCode].players.filter((e, i) => { return e.id == msg.playerId }).length <= 0) return
        if (state.games[msg.gameCode].players[state.games[msg.gameCode].player_index].id != msg.playerId) return
        send(ws, { type: "dice_roll", dice: rollDice() })

        break;
      case "heartbeat":
        if (!msg.playerId || !msg.gameCode) return
        if (!state.players[msg.playerId]) return
        if (!state.games[msg.gameCode]) return
        if (!state.games[msg.gameCode].players) return
        if(state.games[msg.gameCode].players.length ==0) return
        
        /*
        if (state.games[msg.gameCode].players[0].marbles){
          state.games[msg.gameCode].players[0].marbles[0]++
        }
        */
        
        send(ws, { type: 'game_info', game: state.games[msg.gameCode], s: state });
        break;
      case "join_game":
        if (!msg.playerId || !msg.gameCode) return
        if (!state.players[msg.playerId]) return
        if (!state.games[msg.gameCode]) return
        if (!state.games[msg.gameCode].players) { state.games[msg.gameCode].players = [] }
        if (state.games[msg.gameCode].players.length >= 4) return

        let p = {
          id: msg.playerId,
          marbles: [0, 101, 102, 103]
        }
        state.games[msg.gameCode].players.push(p)

        send(ws, { type: 'game_info', game: state.games[msg.gameCode], s: state });
        break;
      case "new_game":
        let gameCode = token8()
        let g = {}
        g.code = gameCode
        g.players = []
        g.player_index = 0
        state.games[gameCode] = g

        send(ws, { type: 'game_info', game: state.games[gameCode], s: state });
        break;
      case "identify":
        if (!msg.playerId || !msg.playerName) {
          return
        }
        if (!state.players[msg.playerId]) {
          let p = {}
          p.id = msg.playerId
          p.name = sanitizeName(msg.playerName);
          state.players[msg.playerId] = p
        }
        state.players[msg.playerId].connected = true;
        state.players[msg.playerId].lastSeen = Date.now();

        send(ws, { type: 'identified', player: state.players[msg.playerId], s: state });
        break;
    }

    return;
  });

  ws.on('close', () => {
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
    if (!ws.isAlive) { try { ws.terminate(); } catch (e) { } continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch (e) { }
  }
}, PING_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`✅ Vex game server listening on http://${HOST}:${PORT}`);
});

process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });

