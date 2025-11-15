(() => {
    // Initialize Variables
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    const FACES = ["\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];
    const PLAYER_CLASSES = ["primary", "warning", "success", "danger"]
    const CENTER_POSITION = 999;

    // DOM
    const nameInput = document.getElementById('nameInput');
    const nameCheck = document.getElementById('nameCheck');
    const charsRemainingNameSpan = document.getElementById('charsRemainingName');
    const gameCodeInput = document.getElementById('gameCode');
    const charsRemainingCodeSpan = document.getElementById('charsRemainingCode');
    const playAreaDiv = document.getElementById('playAreaDiv')
    const playBtn = document.getElementById('playBtn')
    const splashDiv = document.getElementById('splash')
    const playAreaContainer = document.getElementById('playAreaContainer')
    const diceRollBtn = document.getElementById('diceRollBtn')
    const addBotBtn = document.getElementById('addBotBtn')
    const gameCodeSpan = document.getElementById('gameCodeSpan')
    const copyGameCodeBtn = document.getElementById('copyGameCodeBtn')

    const connDot = document.getElementById('connDot')
    const connText = document.getElementById('connText')
    const playerCountSpan = document.getElementById('playerCount')
    const leaderboardDiv = document.getElementById('leaderboardList')



    const game = {
        code: "",
        setCode(code) {
            this.code = code;
            gameCodeInput.value = this.code;
            // Update visible game code in the UI if present and non-empty
            try {
                if (gameCodeSpan) {
                    gameCodeSpan.textContent = (this.code && this.code.toString().trim() !== '') ? this.code : '';
                }
            } catch (e) {}
            this.save();
        },
        save() {
            setCookie('gameCode', this.code);
            setSaved('gameCode', this.code);
        }
    }
    const player = {
        id: getCookie('playerId') || getSaved('playerId') || randUUID(),
        name: getSaved('playerName', ''),
        class: "",
        setName(name) {
            this.name = name
            nameInput.value = this.name
            this.save()
        },
        save() {
            setCookie('playerId', this.id);
            setSaved('playerId', this.id);

            setCookie('playerName', this.name);
            setSaved('playerName', this.name);

            setCookie('playerClass', this.class);
            setSaved('playerClass', this.class);
        }
    }

    let ws;
    let wsConnected = false;
    let disconnectAt = null;
    let reconnectTimer;
    let autoRefreshTimer;
    let heartbeatTimer;
    let currentGameState = null;
    let currentPlayerIndex = -1;

    let mask = [
        [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        [11, 0, 9, 9, 9, 9, 9, 13, 0, 0, 0, 13, 5, 5, 5, 5, 5, 0, 4],
        [11, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 4],
        [0, 0, 10, 9, 9, 9, 9, 0, 0, 14, 0, 0, 5, 5, 5, 5, 6, 0, 0],
        [11, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 4],
        [11, 0, 9, 9, 9, 9, 9, 13, 0, 0, 0, 13, 5, 5, 5, 5, 5, 0, 4],
        [0, 0, 0, 0, 0, 0, 0, 7, 0, 7, 0, 7, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 7, 0, 7, 0, 7, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 7, 0, 7, 0, 7, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 7, 0, 7, 0, 7, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 7, 7, 8, 7, 7, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 12, 12, 0, 12, 12, 0, 0, 0, 0, 0, 0, 0]
    ]

    //normal path through gameboard
    globalThis.path = [{ "x": 9, "y": 2 }, { "x": 10, "y": 2 }, { "x": 11, "y": 2 }, { "x": 11, "y": 3 }, { "x": 11, "y": 4 }, { "x": 11, "y": 5 }, { "x": 11, "y": 6 }, { "x": 11, "y": 7 }, { "x": 12, "y": 7 }, { "x": 13, "y": 7 }, { "x": 14, "y": 7 }, { "x": 15, "y": 7 }, { "x": 16, "y": 7 }, { "x": 16, "y": 8 }, { "x": 16, "y": 9 }, { "x": 16, "y": 10 }, { "x": 16, "y": 11 }, { "x": 15, "y": 11 }, { "x": 14, "y": 11 }, { "x": 13, "y": 11 }, { "x": 12, "y": 11 }, { "x": 11, "y": 11 }, { "x": 11, "y": 12 }, { "x": 11, "y": 13 }, { "x": 11, "y": 14 }, { "x": 11, "y": 15 }, { "x": 11, "y": 16 }, { "x": 10, "y": 16 }, { "x": 9, "y": 16 }, { "x": 8, "y": 16 }, { "x": 7, "y": 16 }, { "x": 7, "y": 15 }, { "x": 7, "y": 14 }, { "x": 7, "y": 13 }, { "x": 7, "y": 12 }, { "x": 7, "y": 11 }, { "x": 6, "y": 11 }, { "x": 5, "y": 11 }, { "x": 4, "y": 11 }, { "x": 3, "y": 11 }, { "x": 2, "y": 11 }, { "x": 2, "y": 10 }, { "x": 2, "y": 9 }, { "x": 2, "y": 8 }, { "x": 2, "y": 7 }, { "x": 3, "y": 7 }, { "x": 4, "y": 7 }, { "x": 5, "y": 7 }, { "x": 6, "y": 7 }, { "x": 7, "y": 7 }, { "x": 7, "y": 6 }, { "x": 7, "y": 5 }, { "x": 7, "y": 4 }, { "x": 7, "y": 3 }, { "x": 7, "y": 2 }, { "x": 8, "y": 2 }]

    gameCodeInput.addEventListener('keyup', (event) => {
        gameCodeInput.value = gameCodeInput.value.replaceAll(/[^a-zA-Z0-9]+/g, "").substr(0, 8)
        charsRemainingCodeSpan.textContent = (8 - gameCodeInput.value.length) + " characters remaining"
    })

    nameInput.addEventListener('keyup', (event) => {
        let n = nameInput.value.replaceAll(/[^a-zA-Z0-9 ]+/g, "").substr(0, 32)
        charsRemainingNameSpan.textContent = (32 - n.length) + " characters remaining."
        player.setName(n)
    })

    diceRollBtn.addEventListener('click', (event) => {
        wsSafeSend({ type: 'roll_dice', playerId: player.id, gameCode: game.code })
    })

    // Add Bot button - requests server to add a bot named "Echo" to the current game
    if (addBotBtn) {
        addBotBtn.addEventListener('click', (ev) => {
            if (!game.code) return;
            // disable immediately to avoid duplicate requests; server will broadcast game_info
                addBotBtn.disabled = true;
                addBotBtn.textContent = 'Adding...';
                const payload = { type: 'add_bot', gameCode: game.code, name: 'Echo', requestedBy: player.id };
                
                // Ensure we're actually part of the game before requesting a bot
                if (!currentGameState || !Array.isArray(currentGameState.players) || !currentGameState.players.some(p => p.id === player.id)) {
                    console.warn('Cannot add bot: you are not a member of this game or game state not loaded');
                    addBotBtn.disabled = false;
                    addBotBtn.textContent = '🤖';
                    return;
                }

                const sent = wsSafeSend(payload);
                if (!sent) {
                    // revert immediately if send failed
                    addBotBtn.disabled = false;
                    addBotBtn.textContent = '🤖';
                }

            // Safety: if server doesn't respond within 5s, revert button so user can retry
            setTimeout(() => {
                try {
                    if (addBotBtn && addBotBtn.textContent === 'Adding...') {
                        addBotBtn.disabled = false;
                        addBotBtn.textContent = '🤖';
                        console.warn('Add Bot timed out — no response from server');
                    }
                } catch (e) {}
            }, 5000);
        });
    }
    playBtn.addEventListener('click', (event) => {
        if (player.name.trim() == "") {
            nameCheck.classList.remove('d-none')
            nameInput.classList.add('border', 'border-danger')
            return
        }

        //ensure the player exists
        wsSafeSend({ type: 'identify', playerId: player.id, playerName: player.name })

        //create the game if it doesn't exist
        if (gameCodeInput.value.toString().trim() == "") { //create a new game
            wsSafeSend({ type: 'new_game' })
        }

        //join the game
        setTimeout(() => {
            wsSafeSend({ type: 'join_game', playerId: player.id, gameCode: gameCodeInput.value })
            playAreaContainer.classList.remove('d-none')
            splashDiv.classList.add('d-none')
        }, 1000)
    })

    function handleMessage(msg) {
        console.log(msg)
        switch (msg.type) {
            case 'dice_roll':
                rollDie({ duration: 100, tick: 60, result: msg.dice })
                break;
            case 'add_bot_ack':
                // Server acknowledgement for add_bot request
                if (msg.ok) {
                    if (addBotBtn) {
                        addBotBtn.disabled = true;
                        addBotBtn.textContent = '🤖';
                    }
                } else {
                    if (addBotBtn) {
                        addBotBtn.disabled = false;
                        addBotBtn.textContent = '🤖';
                    }
                    console.warn('Add Bot failed:', msg.reason || 'unknown');
                }
                break;
            case 'game_info':
                game.setCode(msg.game.code)
                currentGameState = msg.game;

                // Update player count display
                try {
                    if (playerCountSpan) playerCountSpan.textContent = Array.isArray(msg.game.players) ? msg.game.players.length : 0;
                } catch (e) {}

                // Update leaderboard (use server-side snapshot if provided in msg.s)
                try { updateLeaderboard(msg.game, msg.s); } catch (e) {}

                // Find current player's index
                currentPlayerIndex = -1;
                msg.game.players.forEach((p, i) => {
                    if (p.id === player.id) {
                        currentPlayerIndex = i;
                    }
                });

                // Enable/disable the Add Bot button: only allow one bot per game
                if (addBotBtn) {
                    const hasBot = Array.isArray(msg.game.players) && msg.game.players.some(p => p && typeof p.id === 'string' && p.id.startsWith('bot-'));
                    addBotBtn.disabled = hasBot || (Array.isArray(msg.game.players) && msg.game.players.length >= 4);
                    //addBotBtn.textContent = hasBot ? 'Bot Added' : '🤖';
                }

                colorCells()
                disableAllMarbleClicks();

                diceRollBtn.className = '';
                diceRollBtn.classList.add('rounded', 'btn', `btn-${PLAYER_CLASSES[msg.game.player_index]}`)

                const isMyTurn = msg.game.players[msg.game.player_index] && msg.game.players[msg.game.player_index].id ? msg.game.players[msg.game.player_index].id == player.id : false;
                const awaitingRoll = msg.game.phase === 'awaiting_roll';
                const awaitingMove = msg.game.phase === 'awaiting_move';

                if (isMyTurn && awaitingRoll) {
                    diceRollBtn.disabled = false;
                } else {
                    diceRollBtn.disabled = true;
                }

                msg.game.players.forEach((p, i) => {
                    let homeSpaceClass = `board-space border-2 border border-${PLAYER_CLASSES[i]} bg-${PLAYER_CLASSES[i]}`
                    p.marbles.forEach((m, j) => {
                        if (m == 101) {
                            $(`div.board-space[data-x='7'][data-y='0']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 102) {
                            $(`div.board-space[data-x='8'][data-y='0']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 103) {
                            $(`div.board-space[data-x='10'][data-y='0']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 104) {
                            $(`div.board-space[data-x='11'][data-y='0']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 201) {
                            $(`div.board-space[data-x='18'][data-y='7']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 202) {
                            $(`div.board-space[data-x='18'][data-y='8']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 203) {
                            $(`div.board-space[data-x='18'][data-y='10']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 204) {
                            $(`div.board-space[data-x='18'][data-y='11']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 301) {
                            $(`div.board-space[data-x='11'][data-y='18']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 302) {
                            $(`div.board-space[data-x='10'][data-y='18']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 303) {
                            $(`div.board-space[data-x='8'][data-y='18']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 304) {
                            $(`div.board-space[data-x='7'][data-y='18']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 401) {
                            $(`div.board-space[data-x='0'][data-y='11']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 402) {
                            $(`div.board-space[data-x='0'][data-y='10']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 403) {
                            $(`div.board-space[data-x='0'][data-y='8']`).removeClass().addClass(homeSpaceClass)
                        }
                        if (m == 404) {
                            $(`div.board-space[data-x='0'][data-y='7']`).removeClass().addClass(homeSpaceClass)
                        }

                        // Only color if this marble is on the normal path (index within path bounds).
                        if (typeof m === 'number' && m >= 0 && m < path.length) {
                            $(`div.board-space[data-x='${path[m].x}'][data-y='${path[m].y}']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }

                        if (m >= path.length && m < 100){
                            const c = getMarbleCoords(m, i);
                            if (c) $(`div.board-space[data-x='${c.x}'][data-y='${c.y}']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`);
                        }

                        if (m === CENTER_POSITION) {
                            const c = getMarbleCoords(m, i);
                            if (c) $(`div.board-space[data-x='${c.x}'][data-y='${c.y}']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`);
                        }
                    })
                })

                if (isMyTurn && awaitingMove) {
                    enableMarbleClicks();
                }

                break;
            case 'game_over':
                // show winner modal with confetti
                try {
                    const winner = msg.winner || (msg.game && msg.game.winner);
                    if (winner) {
                        showWinnerModal(winner.name || 'Player');
                    }
                } catch (e) {}
                break;
            case 'identified':
                player.setName(msg.player.name)
                break
            case 'eventLog':
                if (msg.event) {
                    const eventLog = document.getElementById('eventLog');
                    if (eventLog) {
                        const eventDiv = document.createElement('div');
                        eventDiv.className = 'line';
                        const time = new Date(msg.event.ts).toLocaleTimeString();
                        eventDiv.innerHTML = `<span class="ts">${time}</span>${msg.event.message}`;
                        eventLog.insertBefore(eventDiv, eventLog.firstChild);

                        // Keep only last 20 events
                        while (eventLog.children.length > 20) {
                            eventLog.removeChild(eventLog.lastChild);
                        }
                    }
                }
                break
            case 'hello':
                break;
            default:
                break;
        }
    }

    // Helper functions for game logic — rely entirely on GameShared (no local fallbacks)
    if (typeof GameShared === 'undefined') {
        console.error('GameShared is not available. Ensure /shared.js is loaded before /client.js');
    }

    
    const getHomePositions = (playerIndex) => GameShared.getHomePositions(playerIndex);

    const isHomePosition = (position, playerIndex) => GameShared.isHomePosition(position, playerIndex);

    const canMoveFromHome = (diceValue) => GameShared.canMoveFromHome(diceValue);

    const getStartPosition = (playerIndex) => GameShared.getStartPosition(playerIndex);

    const wouldBlockSelf = (marbles, movingIndex, targetPosition) => GameShared.wouldBlockSelf(marbles, movingIndex, targetPosition);

    const canMoveMarble = (marbleIndex, playerIndex, diceValue) => {
        if (!currentGameState || !currentGameState.players[playerIndex]) return false;
        const player = currentGameState.players[playerIndex];
        const currentPos = player.marbles[marbleIndex];
        const validDests = getValidDestinations(currentPos, diceValue, playerIndex, player.marbles, marbleIndex);
        return validDests.length > 0;
    };

    const enableMarbleClicks = () => {
        if (!currentGameState || currentPlayerIndex === -1) return;
        if (currentGameState.phase !== 'awaiting_move') return;
        if (currentGameState.players[currentGameState.player_index].id !== player.id) return;

        const myPlayer = currentGameState.players[currentPlayerIndex];
        const diceValue = currentGameState.last_roll;

        myPlayer.marbles.forEach((marblePos, marbleIndex) => {
            // compute valid destinations and log them for debugging
            const validDests = getValidDestinations(marblePos, diceValue, currentPlayerIndex, myPlayer.marbles, marbleIndex);
            if (validDests.length > 0) {
                const coords = getMarbleCoords(marblePos, currentPlayerIndex);
                if (coords) {
                    const elem = $(`div.board-space[data-x='${coords.x}'][data-y='${coords.y}']`);
                    elem.addClass('clickable-marble');
                    elem.attr('data-marble-index', marbleIndex);
                }
            }
        });
    };

    const getMarbleCoords = (position, playerIndex) => {
        // Only treat as a path index if it's within the path array bounds.
        // Base positions were encoded as 56..71 and should NOT be treated as path indices.
        if (typeof position === 'number' && position >= 0 && position < path.length) {
            return path[position];
        }

        const homeCoords = {
            101: { x: 7, y: 0 }, 102: { x: 8, y: 0 }, 103: { x: 10, y: 0 }, 104: { x: 11, y: 0 },
            201: { x: 18, y: 7 }, 202: { x: 18, y: 8 }, 203: { x: 18, y: 10 }, 204: { x: 18, y: 11 },
            301: { x: 11, y: 18 }, 302: { x: 10, y: 18 }, 303: { x: 8, y: 18 }, 304: { x: 7, y: 18 },
            401: { x: 0, y: 7 }, 402: { x: 0, y: 8 }, 403: { x: 0, y: 10 }, 404: { x: 0, y: 11 }
        };
        if (position === CENTER_POSITION) return { x: 9, y: 9 };
        // Base positions (encoded 56..71) map to board coordinates for each player's base
        // Player 0 bases: 56-59 -> {9,3}, {9,4}, {9,5}, {9,6}
        // Player 1 bases: 60-63 -> {15,9}, {14,9}, {13,9}, {12,9}
        // Player 2 bases: 64-67 -> {9,15}, {9,14}, {9,13}, {9,12}
        // Player 3 bases: 68-71 -> {3,9}, {4,9}, {5,9}, {6,9}
        const baseMap = {
            56: { x: 9, y: 3 }, 57: { x: 9, y: 4 }, 58: { x: 9, y: 5 }, 59: { x: 9, y: 6 },
            60: { x: 15, y: 9 }, 61: { x: 14, y: 9 }, 62: { x: 13, y: 9 }, 63: { x: 12, y: 9 },
            64: { x: 9, y: 15 }, 65: { x: 9, y: 14 }, 66: { x: 9, y: 13 }, 67: { x: 9, y: 12 },
            68: { x: 3, y: 9 }, 69: { x: 4, y: 9 }, 70: { x: 5, y: 9 }, 71: { x: 6, y: 9 }
        };

        return homeCoords[position] || baseMap[position] || null;
    };

    const disableAllMarbleClicks = () => {
        $('.clickable-marble').removeClass('clickable-marble').removeAttr('data-marble-index');
    };

    const disableAllDestinations = () => {
        $('.clickable-destination').removeClass('clickable-destination').removeAttr('data-destination');
    };

    // Track selected marble
    let selectedMarble = null;

    // Use GameShared for star checks and valid destinations
    const isStarPosition = (position) => GameShared.isStarPosition(position);

    const getValidDestinations = (currentPosition, steps, playerIndex, allMarbles, movingIndex) => {
        return GameShared.getValidDestinations(currentPosition, steps, playerIndex, allMarbles, movingIndex);
    };

    const getBasePositions = (playerIndex) => GameShared.getBasePositions ? GameShared.getBasePositions(playerIndex) : [];

    // Update leaderboard UI with count of marbles in base per player
    function updateLeaderboard(game, stateSnapshot) {
        try {
            if (!leaderboardDiv) return;
            leaderboardDiv.innerHTML = '';
            if (!game || !Array.isArray(game.players)) return;

            const list = document.createElement('div');
            list.className = 'list-group';

            game.players.forEach((p, i) => {
                const basePositions = getBasePositions(i) || [];
                const inBaseCount = Array.isArray(p.marbles) ? p.marbles.filter(m => basePositions.includes(m)).length : 0;

                // Try to get player name from state snapshot if provided
                let displayName = (stateSnapshot && stateSnapshot.players && stateSnapshot.players[p.id] && stateSnapshot.players[p.id].name) || p.name || p.id || `P${i+1}`;
                if (typeof displayName === 'string' && displayName.length > 18) displayName = displayName.substr(0, 16) + '…';

                const item = document.createElement('div');
                item.className = 'list-group-item d-flex justify-content-between align-items-center';
                // color indicator
                const nameWrap = document.createElement('div');
                nameWrap.innerHTML = `<span class="fw-semibold">${escapeHtml(displayName)}</span>`;
                const badge = document.createElement('span');
                badge.className = `badge bg-primary rounded-pill`;
                badge.textContent = `${inBaseCount}/4`;

                item.appendChild(nameWrap);
                item.appendChild(badge);
                list.appendChild(item);
            });

            leaderboardDiv.appendChild(list);
        } catch (e) {
            // ignore UI errors
        }
    }

    // small helper to escape HTML when injecting names
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    const showValidDestinations = (marbleIndex) => {
        if (!currentGameState || currentPlayerIndex === -1) return;
        const myPlayer = currentGameState.players[currentPlayerIndex];
        const diceValue = currentGameState.last_roll;
        const currentPos = myPlayer.marbles[marbleIndex];

        const validDests = getValidDestinations(currentPos, diceValue, currentPlayerIndex, myPlayer.marbles, marbleIndex);
        
        validDests.forEach(destPos => {
            const coords = getMarbleCoords(destPos, currentPlayerIndex);
            if (coords) {
                const elem = $(`div.board-space[data-x='${coords.x}'][data-y='${coords.y}']`);
                elem.addClass('clickable-destination');
                elem.attr('data-destination', destPos);
            } 
        });
    };

    // init browser
    function init() {
        for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {

                let myDiv = document.createElement('div')
                myDiv.classList.add('border', 'board-space', 'rounded')
                myDiv.setAttribute('data-x', x)
                myDiv.setAttribute('data-y', y)
                myDiv.title = `${x}, ${y}`

                playAreaDiv.appendChild(myDiv)
            }
        }
        colorCells()

        // Add click handler for marbles and destinations using event delegation
        playAreaDiv.addEventListener('click', (event) => {
            const target = event.target;

            // Click on a marble - select it and show valid destinations
            if (target.classList.contains('clickable-marble')) {
                const marbleIndex = parseInt(target.getAttribute('data-marble-index'));
                if (!isNaN(marbleIndex)) {
                    // Clear previous destinations and selection
                    disableAllDestinations();
                    $('.selected-marble').removeClass('selected-marble');
                    // Select new marble and show its destinations
                    selectedMarble = marbleIndex;
                    showValidDestinations(marbleIndex);
                    target.classList.add('selected-marble');
                }
            }
            // Click on a destination - make the move
            else if (target.classList.contains('clickable-destination')) {
                const destination = parseInt(target.getAttribute('data-destination'));
                if (!isNaN(destination) && selectedMarble !== null) {
                    wsSafeSend({
                        type: 'move_marble',
                        playerId: player.id,
                        gameCode: game.code,
                        marbleIndex: selectedMarble,
                        destination: destination
                    });
                    selectedMarble = null;
                    disableAllMarbleClicks();
                    disableAllDestinations();
                    $('.selected-marble').removeClass('selected-marble');
                }
            }
            // Click elsewhere - deselect
            else if (selectedMarble !== null) {
                selectedMarble = null;
                disableAllDestinations();
                $('.selected-marble').removeClass('selected-marble');
            }
        });
    }
    function marchCells() {
        let idx = 0;
        setInterval(() => {
            console.log(globalThis.path[idx])
            colorCells()
            $(`div.board-space[data-x='${globalThis.path[idx].x}'][data-y='${globalThis.path[idx].y}']`).removeClass().addClass('board-space bg-primary')

            idx++
        }, 1000)
    }

    function colorCells() {
        for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {
                switch (mask[y][x]) {
                    case 0:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space invisible')
                        break;
                    case 1:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-primary border-2 bg-primary bg-opacity-25')
                        break;
                    case 2:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-primary bg-primary bg-opacity-25')
                        break;
                    case 3:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-primary bg-opacity-50')
                        break;
                    case 4:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-warning border-2 bg-warning bg-opacity-25')
                        break;
                    case 5:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-warning bg-warning bg-opacity-25')
                        break;
                    case 6:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-warning bg-opacity-50')
                        break;
                    case 7:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-success bg-success bg-opacity-25')
                        break;
                    case 8:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-dark border-1 bg-success bg-opacity-50')
                        break;
                    case 9:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-danger bg-danger bg-opacity-25')
                        break;
                    case 10:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-danger bg-opacity-50')
                        break;
                    case 11:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-danger border-2 bg-danger bg-opacity-25')
                        break;
                    case 12:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-success border-2 bg-success bg-opacity-25')
                        break;
                    case 13:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-info border-2 bg-info bg-opacity-25')
                        break;
                    case 14:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-dark border-2 bg-dark bg-opacity-50')
                        break;
                }
            }
        }
    }


    // Persistence
    function getSaved(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } }
    function setSaved(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
    }
    function setCookie(name, value, days = 365) {
        const d = new Date(); d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
    }

    // utilities
    function randUUID() {
        return "uuid-" + Math.random().toString(36).substring(2) + Date.now().toString(36)
    }

    async function rollDie({ duration = 100, tick = 70, result } = {}) {
        const die = document.getElementById('die');

        die.classList.add('shake');

        // Cycle faces for a short time to look lively
        const t0 = performance.now();
        let frame = 0;
        const cycle = () => {
            const t = performance.now() - t0;
            // ease-out effect by slowing ticks near the end
            const ease = Math.min(1, t / duration);
            const thisTick = tick + ease * 120; // slows down
            die.textContent = FACES[frame % 6];
            frame++;
            if (t < duration) {
                setTimeout(cycle, thisTick);
            } else {
                // Final real roll
                die.textContent = FACES[result - 1];
                die.classList.remove('shake');

            }
        };
        cycle();
    }

    // websocket
    function connect() {
        ws = new WebSocket(WS_URL);
        setConnStatus(false, 'Connecting…');

        ws.addEventListener('open', () => {
            wsConnected = true;
            disconnectAt = null;
            setConnStatus(true, 'Connected');
            ws.send(JSON.stringify({ type: 'identify', playerId: player.id, playerName: player.name }));

        });

        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            handleMessage(msg);
        });

        ws.addEventListener('close', () => {
            wsConnected = false;
            setConnStatus(false, 'Disconnected');
            if (!disconnectAt) disconnectAt = Date.now();
            // Auto-refresh if broken > 10s
            if (!autoRefreshTimer) {
                autoRefreshTimer = setInterval(() => {
                    if (!wsConnected && disconnectAt && Date.now() - disconnectAt > 10_000) {
                        location.reload();
                    }
                }, 1000);
            }
            scheduleReconnect();
        });

        ws.addEventListener('error', () => {
            wsConnected = false;
            setConnStatus(false, 'Error');
            scheduleReconnect();
        });
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, 1000 + Math.random() * 1000);
    }

    function setConnStatus(ok, text) {
        connDot.classList.toggle('online', ok);
        connDot.classList.toggle('offline', !ok);
        connText.textContent = text;
    }

    function wsSafeSend(obj) {
        console.log(obj)
        try {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(obj));
                return true;
            }
        } catch (e) {
            console.error('[DBG] ws send error', e);
        }
        return false;
    }

    // Expose small debug helpers on window so you can inspect client state from the browser console.
    // Use these in the console like: VEX.getWSState(), VEX.getGameState(), VEX.getPlayer()
    try {
        window.VEX = window.VEX || {};
        window.VEX.getWSState = () => (typeof ws !== 'undefined' ? (ws ? ws.readyState : null) : null);
        window.VEX.getGameState = () => currentGameState;
        window.VEX.getPlayer = () => ({ id: player.id, name: player.name });
        window.VEX.send = (o) => { wsSafeSend(o); };        
    } catch (e) {
        // ignore if window isn't available
    }

    // Winner modal helpers and confetti
    const winnerModal = document.getElementById('winnerModal');
    const winnerNameEl = document.getElementById('winnerName');
    const winnerCloseBtn = document.getElementById('winnerCloseBtn');
    const confettiContainer = document.getElementById('confettiContainer');
    let confettiTimer = null;

    function clearConfetti() {
        if (confettiTimer) {
            clearInterval(confettiTimer);
            confettiTimer = null;
        }
        if (confettiContainer) confettiContainer.innerHTML = '';
    }

    function startConfetti() {
        if (!confettiContainer) return;
        clearConfetti();
        const colors = ['#ff5c5c','#ffd166','#06d6a0','#118ab2','#9b5de5','#f15bb5'];
        confettiTimer = setInterval(() => {
            const el = document.createElement('div');
            const size = 6 + Math.random() * 10;
            el.style.position = 'absolute';
            el.style.left = (20 + Math.random() * 380) + 'px';
            el.style.top = '-20px';
            el.style.width = `${size}px`;
            el.style.height = `${size * 0.6}px`;
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            el.style.opacity = '0.95';
            el.style.transform = `rotate(${Math.random()*360}deg)`;
            el.style.borderRadius = '2px';
            confettiContainer.appendChild(el);
            const fall = 2000 + Math.random() * 2000;
            const drift = (Math.random() - 0.5) * 100;
            const start = performance.now();
            const id = setInterval(() => {
                const t = (performance.now() - start) / fall;
                if (t >= 1) {
                    clearInterval(id);
                    try { confettiContainer.removeChild(el); } catch (e) {}
                    return;
                }
                el.style.top = (t * 140) + 'px';
                el.style.left = (parseFloat(el.style.left) + drift * 0.01) + 'px';
            }, 16);
        }, 100);
    }

    function showWinnerModal(name) {
        try {
            if (winnerNameEl) winnerNameEl.textContent = name;
            if (winnerModal) winnerModal.style.display = 'flex';
            startConfetti();
        } catch (e) {}
    }

    function hideWinnerModal() {
        try {
            if (winnerModal) winnerModal.style.display = 'none';
            clearConfetti();
        } catch (e) {}
    }

    if (winnerCloseBtn) {
        winnerCloseBtn.addEventListener('click', (ev) => {
            // request server to restart game
            try {
                wsSafeSend({ type: 'restart_game', gameCode: (game && game.code) ? game.code : '' });
            } catch (e) {}
            hideWinnerModal();
        });
    }

    // Kick things off
    init()
    connect();
})();