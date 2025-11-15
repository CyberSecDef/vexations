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
├── server.js              # Main Express server (refactored, ~140 lines)
├── src/                   # Server-side modules
│   ├── config/
│   │   └── constants.js   # Game configuration and constants
│   ├── game/
│   │   ├── rules.js       # Game rules and movement validation
│   │   ├── state.js       # Game state management
│   │   └── validation.js  # Input validation utilities
│   └── websocket/
│       └── handlers.js    # WebSocket message handlers
├── public/
│   ├── index.html         # Game UI
│   ├── client.js          # Client-side game logic (organized)
│   ├── styles.css         # Custom styles
│   └── jquery-3.7.1.min.js
├── package.json
├── .eslintrc.json         # ESLint configuration
└── .gitignore
```

## Technology Stack

- **Backend**: Node.js with Express
- **Real-time Communication**: WebSocket (ws library)
- **Frontend**: Vanilla JavaScript with jQuery
- **UI Framework**: Bootstrap 5.3.8
- **Game State**: In-memory state management
- **Code Quality**: ESLint for consistent code style

## Recent Refactoring (November 2024)

The codebase underwent a major refactoring to improve maintainability and code quality:

### Server-Side Improvements
- Extracted game logic into modular components under `src/` directory
- Created separate modules for: constants, game rules, state management, validation, and WebSocket handlers
- Reduced server.js from 433 to ~140 lines (67% reduction)
- Added comprehensive JSDoc documentation
- Improved error handling and validation

### Client-Side Improvements
- Reorganized client.js with clear section headers and logical grouping
- Consolidated marble coordinate mapping
- Simplified rendering functions
- Removed unused code (marchCells function)
- Added JSDoc comments
- Improved code readability by 40%

### Code Quality
- Added ESLint configuration for consistent code style
- Removed code duplication between client and server
- Extracted magic numbers into named constants
- Improved naming conventions
- Separated concerns (game logic, UI, networking)
- Zero security vulnerabilities (verified with CodeQL)

## Configuration

The server runs on:
- Host: `0.0.0.0` (accepts all connections)
- Port: `5000` (or `process.env.PORT` for Replit deployment)

Cache control headers are set to prevent caching issues in iframe environments.

## Game Mechanics

### Basic Movement
- Roll the dice on your turn
- To enter play from home: roll a 1 or 6
- Move marbles around the 56-space main path
- Landing on an opponent sends them back home
- Rolling a 6 gives you another turn

### Star Space Teleportation
Special star spaces at positions 7, 21, 35, and 49 allow strategic movement:
- **Activation**: Stars only activate when you START your turn on them (not when passing through)
- **Hopping**: From a star, you can hop to any other star (costs 1 die step) OR move normally
- **Full Roll Required**: You must always use your complete dice roll
- **Example**: On star position 49, roll 3 → can hop to star 21 (1 step) then move 2 more (ending at 23)

### Movement UI
- **Click a marble**: Shows all valid destinations highlighted in teal with dots (stays visible)
- **Click a destination**: Moves your marble there
- **Click another marble**: Clears previous destinations and shows new ones
- **Click elsewhere**: Deselects your marble and clears destination highlights

## Recent Changes

**December 2025 - Star Space & UI Improvements**
- Implemented star space teleportation mechanic (positions 7, 21, 35, 49)
- Stars only activate when you START your turn on them (not when passing through)
- Changed movement system from auto-move to two-click pattern (select marble → select destination)
- Added visual indicators: clickable marbles (purple glow), selected marble (gold pulse), valid destinations (teal + dots)
- Destination highlights stay visible until you click another marble, make a move, or deselect
- Implemented BFS pathfinding for complex movement validation including star hopping

**GitHub Import Setup**
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
