# Vexations

A multiplayer round-based aggravation board game with real-time gameplay using WebSockets.

## Overview

Vexations is a web-based multiplayer board game where players race their marbles to victory. The game features:
- Real-time multiplayer gameplay via WebSockets
- Mobile-first responsive UI using Bootstrap
- Round-based dice rolling mechanics
- Up to 4 players per game
- Game code system for easy matchmaking

## Project Structure

```
├── server.js           # Express server with WebSocket support
├── public/
│   ├── index.html      # Game UI
│   ├── client.js       # Client-side game logic
│   ├── styles.css      # Custom styles
│   └── jquery-3.7.1.min.js
├── package.json
└── .gitignore
```

## Technology Stack

- **Backend**: Node.js with Express
- **Real-time Communication**: WebSocket (ws library)
- **Frontend**: Vanilla JavaScript with jQuery
- **UI Framework**: Bootstrap 5.3.8
- **Game State**: In-memory state management

## Configuration

The server runs on:
- Host: `0.0.0.0` (accepts all connections)
- Port: `5000` (or `process.env.PORT` for Replit deployment)

Cache control headers are set to prevent caching issues in iframe environments.

## Recent Changes (GitHub Import Setup)

- Changed server port from 8010 to 5000 for Replit compatibility
- Added `process.env.PORT` support for deployment flexibility
- Added cache-control middleware to prevent iframe caching issues
- Fixed client-side JavaScript error in init() function
- Configured workflow for automatic server startup
- Set up deployment configuration for Replit autoscale

## How to Play

1. Enter your name
2. Either create a new game (leave Game Code blank) or join an existing game (enter Game Code)
3. Click "Play"
4. Wait for other players to join (up to 4 players)
5. Roll the dice when it's your turn
6. Move your marbles around the board
7. Race to get all your marbles home!

## Development

Run locally:
```bash
npm install
npm start
```

The game will be available at `http://localhost:5000`
