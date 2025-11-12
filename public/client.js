(() => {
    // Initialize Variables
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    const FACES = ["\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"];
    const PLAYER_CLASSES = ["primary", "warning", "success", "danger"]
    // DOM
    const nameInput = document.getElementById('nameInput');
    const nameCheck = document.getElementById('nameCheck');
    const charsRemainingNameSpan = document.getElementById('charsRemainingName');
    const gameCodeInput = document.getElementById('gameCode');
    const gameCodeDiv = document.getElementById('gameCodeDiv')
    const charsRemainingCodeSpan = document.getElementById('charsRemainingCode');
    const playAreaDiv = document.getElementById('playArea')
    const playBtn = document.getElementById('playBtn')
    const splashDiv = document.getElementById('splash')
    const playAreaContainer = document.getElementById('playareaContainer')
    const diceRollBtn = document.getElementById('diceRollBtn')

    const game = {
        code: "",
        setCode(code) {
            this.code = code;
            gameCodeInput.value = this.code;
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
    let snapshot = null; // last server snapshot
    let reconnectTimer;
    let heartbeatTimer;
    let autoRefreshTimer;
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
            playareaContainer.classList.remove('d-none')
            splashDiv.classList.add('d-none')
        }, 1000)
    })

    function handleMessage(msg) {
        console.log(msg)
        switch (msg.type) {
            case 'dice_roll':
                rollDie({ duration: 1600, tick: 60, result: msg.dice })
                break;
            case 'game_info':
                game.setCode(msg.game.code)
                currentGameState = msg.game;
                
                // Find current player's index
                currentPlayerIndex = -1;
                msg.game.players.forEach((p, i) => {
                    if (p.id === player.id) {
                        currentPlayerIndex = i;
                    }
                });
                
                colorCells()
                disableAllMarbleClicks();
                
                diceRollBtn.className = '';
                diceRollBtn.classList.add('rounded', 'btn', `btn-${PLAYER_CLASSES[msg.game.player_index]}`)
                
                const isMyTurn = msg.game.players[msg.game.player_index].id == player.id;
                const awaitingRoll = msg.game.phase === 'awaiting_roll';
                const awaitingMove = msg.game.phase === 'awaiting_move';
                
                if (isMyTurn && awaitingRoll) {
                    diceRollBtn.disabled = false;
                } else {
                    diceRollBtn.disabled = true;
                }

                msg.game.players.forEach((p, i) => {
                    p.marbles.forEach((m, j) => {
                        if (m == 100) {
                            $(`div.board-space[data-x='7'][data-y='0']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 101) {
                            $(`div.board-space[data-x='8'][data-y='0']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 102) {
                            $(`div.board-space[data-x='10'][data-y='0']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 103) {
                            $(`div.board-space[data-x='11'][data-y='0']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 200) {
                            $(`div.board-space[data-x='18'][data-y='7']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 201) {
                            $(`div.board-space[data-x='18'][data-y='8']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 202) {
                            $(`div.board-space[data-x='18'][data-y='10']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 203) {
                            $(`div.board-space[data-x='18'][data-y='11']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 300) {
                            $(`div.board-space[data-x='11'][data-y='18']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 301) {
                            $(`div.board-space[data-x='10'][data-y='18']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 302) {
                            $(`div.board-space[data-x='8'][data-y='18']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 303) {
                            $(`div.board-space[data-x='7'][data-y='18']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 400) {
                            $(`div.board-space[data-x='0'][data-y='11']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 401) {
                            $(`div.board-space[data-x='0'][data-y='10']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 402) {
                            $(`div.board-space[data-x='0'][data-y='8']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                        if (m == 403) {
                            $(`div.board-space[data-x='0'][data-y='7']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }

                        if (m < 100) {
                            $(`div.board-space[data-x='${path[m].x}'][data-y='${path[m].y}']`).removeClass().addClass(`board-space bg-${PLAYER_CLASSES[i]}`)
                        }
                    })
                })
                
                if (isMyTurn && awaitingMove) {
                    enableMarbleClicks();
                }

                break;
            case 'identified':
                playerName.value = msg.player.name
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

    // Helper functions for game logic
    const getHomePositions = (playerIndex) => {
        const homes = [
            [101, 102, 103, 104],
            [201, 202, 203, 204],
            [301, 302, 303, 304],
            [401, 402, 403, 404]
        ];
        return homes[playerIndex] || [];
    };

    const isHomePosition = (position, playerIndex) => {
        return getHomePositions(playerIndex).includes(position);
    };

    const canMoveFromHome = (diceValue) => {
        return diceValue === 1 || diceValue === 6;
    };

    const getStartPosition = (playerIndex) => {
        return [0, 14, 28, 42][playerIndex] || 0;
    };

    const getNextPosition = (currentPosition, steps, playerIndex) => {
        if (isHomePosition(currentPosition, playerIndex)) {
            if (canMoveFromHome(steps)) {
                return getStartPosition(playerIndex);
            }
            return null;
        }
        return (currentPosition + steps) % 56;
    };

    const wouldBlockSelf = (marbles, movingIndex, targetPosition) => {
        for (let i = 0; i < marbles.length; i++) {
            if (i !== movingIndex && marbles[i] === targetPosition) {
                return true;
            }
        }
        return false;
    };

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
            if (canMoveMarble(marbleIndex, currentPlayerIndex, diceValue)) {
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
        if (position < 100) {
            return path[position];
        }
        
        const homeCoords = {
            101: {x: 8, y: 0}, 102: {x: 10, y: 0}, 103: {x: 7, y: 0}, 104: {x: 11, y: 0},
            201: {x: 18, y: 8}, 202: {x: 18, y: 10}, 203: {x: 18, y: 7}, 204: {x: 18, y: 11},
            301: {x: 10, y: 18}, 302: {x: 8, y: 18}, 303: {x: 11, y: 18}, 304: {x: 7, y: 18},
            401: {x: 0, y: 10}, 402: {x: 0, y: 8}, 403: {x: 0, y: 11}, 404: {x: 0, y: 7}
        };
        
        return homeCoords[position] || null;
    };

    const disableAllMarbleClicks = () => {
        $('.clickable-marble').removeClass('clickable-marble').removeAttr('data-marble-index');
    };
    
    const disableAllDestinations = () => {
        $('.clickable-destination').removeClass('clickable-destination').removeAttr('data-destination');
    };
    
    // Track selected marble
    let selectedMarble = null;
    
    // Star positions matching server
    const STAR_POSITIONS = [7, 21, 35, 49];
    
    const isStarPosition = (position) => {
        return STAR_POSITIONS.includes(position);
    };
    
    // Calculate valid destinations (matching server-side logic)
    // Star hopping only works if you START on a star (not if you pass through one)
    const getValidDestinations = (currentPosition, steps, playerIndex, allMarbles, movingIndex) => {
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
        
        // BFS to explore all paths step-by-step
        const queue = [{pos: currentPosition, stepsLeft: steps, visitedStars: new Set()}];
        const reachable = new Set();
        const visited = new Map();
        
        const makeKey = (pos, stepsLeft, visitedStars) => {
            const starList = Array.from(visitedStars).sort().join(',');
            return `${pos},${stepsLeft},${starList}`;
        };
        
        while (queue.length > 0) {
            const {pos, stepsLeft, visitedStars} = queue.shift();
            const key = makeKey(pos, stepsLeft, visitedStars);
            
            if (visited.has(key)) continue;
            visited.set(key, true);
            
            if (stepsLeft === 0) {
                if (pos !== currentPosition && !wouldBlockSelf(allMarbles, movingIndex, pos)) {
                    reachable.add(pos);
                }
                continue;
            }
            
            // Always allow moving forward 1 step
            const nextPos = (pos + 1) % 56;
            queue.push({pos: nextPos, stepsLeft: stepsLeft - 1, visitedStars: new Set(visitedStars)});
            
            // Star hopping only works if we're still at the starting position AND it's a star
            // You can't hop to stars you reach mid-move
            if (pos === currentPosition && isStarPosition(pos)) {
                // Can also hop to another unvisited star (costs 1 step)
                for (const starPos of STAR_POSITIONS) {
                    if (starPos !== pos && !visitedStars.has(starPos)) {
                        const newVisited = new Set(visitedStars);
                        newVisited.add(starPos);
                        queue.push({pos: starPos, stepsLeft: stepsLeft - 1, visitedStars: newVisited});
                    }
                }
            }
        }
        
        return Array.from(reachable);
    };
    
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

    function setMarbles() {

    }
    // init browser
    function init() {
        for (let y = 0; y < 19; y++) {
            for (let x = 0; x < 19; x++) {

                let myDiv = document.createElement('div')
                myDiv.classList.add('border', 'board-space', 'rounded')
                myDiv.setAttribute('data-x', x)
                myDiv.setAttribute('data-y', y)
                myDiv.title = `${x}, ${y}`

                playArea.appendChild(myDiv)
            }
        }
        colorCells()
        
        // Add click handler for marbles and destinations using event delegation
        playArea.addEventListener('click', (event) => {
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
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-primary bg-opacity-75')
                        break;
                    case 4:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-warning border-2 bg-warning bg-opacity-25')
                        break;
                    case 5:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-warning bg-warning bg-opacity-25')
                        break;
                    case 6:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-warning bg-opacity-75')
                        break;
                    case 7:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-success bg-success bg-opacity-25')
                        break;
                    case 8:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-dark border-1 bg-success bg-opacity-75')
                        break;
                    case 9:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space border border-danger bg-danger bg-opacity-25')
                        break;
                    case 10:
                        $(`div.board-space[data-x='${x}'][data-y='${y}']`).removeClass().addClass('board-space  border border-dark border-1 bg-danger bg-opacity-75')
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

    async function rollDie({ duration = 1400, tick = 70, result } = {}) {
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
            ws.send(JSON.stringify({ type: 'identify', id: player.id, name: player.name }));
            heartbeatTimer = setInterval(() => {
                console.log(game)
                if (game.code) {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'heartbeat', playerId: player.id, gameCode: game.code }));
                }
            }, 1000);
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
        try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); } catch { }
    }

    // Kick things off
    init()
    connect();
})();