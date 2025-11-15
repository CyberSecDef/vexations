/**
 * Core game rules and validation logic
 * Pure functions with no side effects - can be used by both client and server
 */

const {
    STAR_POSITIONS,
    CENTER_POSITION,
    HOME_POSITION_BASES,
    START_POSITIONS,
    SPECIAL_ROLL_VALUES,
    PATH_LENGTH,
    BASE_POSITIONS,
} = require('./constants');

/**
 * Check if a position is a base position and return { playerIndex, index }
 * or null if not a base position
 */
function findBasePosition(position) {
    for (let p = 0; p < BASE_POSITIONS.length; p++) {
        const idx = BASE_POSITIONS[p].indexOf(position);
        if (idx !== -1) return { playerIndex: p, index: idx };
    }
    return null;
}

function getBasePositions(playerIndex) {
    return BASE_POSITIONS[playerIndex] || [];
}

/**
 * Get home positions for a player based on their index
 */
function getHomePositions(playerIndex) {
    const homes = [
        [101, 102, 103, 104],
        [201, 202, 203, 204],
        [301, 302, 303, 304],
        [401, 402, 403, 404]
    ];
    return homes[playerIndex] || [];
}

/**
 * Get the starting position on the path for a player
 */
function getStartPosition(playerIndex) {
    return START_POSITIONS[playerIndex] || 0;
}

/**
 * Check if a position is a home position for a specific player
 */
function isHomePosition(position, playerIndex) {
    return getHomePositions(playerIndex).includes(position);
}

/**
 * Check if a dice value allows moving from home
 */
function canMoveFromHome(diceValue) {
    return SPECIAL_ROLL_VALUES.includes(diceValue);
}

/**
 * Check if moving to a target position would block the player's own marble
 */
function wouldBlockSelf(marbles, movingIndex, targetPosition) {
    for (let i = 0; i < marbles.length; i++) {
        if (i !== movingIndex && marbles[i] === targetPosition) {
            return true;
        }
    }
    return false;
}

/**
 * Check if a position is a star position
 */
function isStarPosition(position) {
    return STAR_POSITIONS.includes(position);
}

/**
 * Calculate all valid destinations from a position with given steps
 * Returns array of possible destination positions (only positions using EXACT steps)
 * - Star hopping only works if you START on a star (not if you pass through one)
 * - Center entry must be exact
 * - Center exit is only on dice roll of 1
 * - Cannot pass through own marbles
 */
function getValidDestinations(currentPosition, steps, playerIndex, allMarbles, movingIndex) {
    // If currently in center: only exit on exact roll 1 to any star position
    if (currentPosition === CENTER_POSITION) {
        if (steps === 1) {
            return STAR_POSITIONS.filter(starPos => !wouldBlockSelf(allMarbles, movingIndex, starPos));
        }
        return [];
    }

    // If in home, can only move to start position with a special roll
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
    // starHopsAllowed: true only if the move STARTS on a star; once a normal path step is taken, star hops are no longer allowed
    const startOnStar = isStarPosition(currentPosition);
    const queue = [{ pos: currentPosition, stepsLeft: steps, starHopsAllowed: startOnStar }];
    const reachable = new Set();
    const visited = new Set();

    const makeKey = (pos, stepsLeft, starHopsAllowed) => `${pos},${stepsLeft},${starHopsAllowed}`;

    while (queue.length > 0) {
        const { pos, stepsLeft, starHopsAllowed } = queue.shift();
        const key = makeKey(pos, stepsLeft, starHopsAllowed);
        if (visited.has(key)) continue;
        visited.add(key);

        // If we've used all steps, this is a valid destination (cannot be the starting square)
        if (stepsLeft === 0) {
            if (pos !== currentPosition && !wouldBlockSelf(allMarbles, movingIndex, pos)) {
                reachable.add(pos);
            }
            continue;
        }

        // If we're in the center during movement we cannot continue (center exit only allowed when STARTING from center)
        if (pos === CENTER_POSITION) continue;

        // 1) If we're currently in a base position, we can only move forward in that base (for the owning player)
        const baseInfo = findBasePosition(pos);
        if (baseInfo) {
            // Only allow moving further into the same player's base
            if (baseInfo.playerIndex === playerIndex) {
                const baseArr = getBasePositions(playerIndex);
                const nextBaseIdx = baseInfo.index + 1;
                if (nextBaseIdx < baseArr.length) {
                    const nextBasePos = baseArr[nextBaseIdx];
                    if (!wouldBlockSelf(allMarbles, movingIndex, nextBasePos)) {
                        queue.push({ pos: nextBasePos, stepsLeft: stepsLeft - 1, starHopsAllowed: false });
                    }
                }
            }
            // cannot move if in another player's base or no further base slots
            continue;
        }

        // 2) Normal forward step along the main path — but if the next square would be the player's start position,
        // treat that as entry into the player's base (first base slot) instead of wrapping to path start
        const nextPos = (pos + 1) % PATH_LENGTH;
        const playerStart = getStartPosition(playerIndex);
        if (nextPos === playerStart) {
            const baseArr = getBasePositions(playerIndex);
            if (baseArr.length > 0) {
                const baseStart = baseArr[0];
                if (!wouldBlockSelf(allMarbles, movingIndex, baseStart)) {
                    queue.push({ pos: baseStart, stepsLeft: stepsLeft - 1, starHopsAllowed: false });
                }
            }
        } else {
            if (!wouldBlockSelf(allMarbles, movingIndex, nextPos)) {
                // Once we take a normal path step, star hopping is no longer permitted for this move
                queue.push({ pos: nextPos, stepsLeft: stepsLeft - 1, starHopsAllowed: false });
            }
        }

        // 3) Center entry from a star (allowed during movement)
        if (isStarPosition(pos)) {
            // moving into center consumes a step; once in center you cannot continue
            if (!wouldBlockSelf(allMarbles, movingIndex, CENTER_POSITION)) {
                // Only enqueue center if it is reachable by this step (it may be the landing spot)
                queue.push({ pos: CENTER_POSITION, stepsLeft: stepsLeft - 1, starHopsAllowed: false });
            }
        }

        // 4) Star hopping (clockwise) - only allowed if this move started on a star and we have not yet taken a normal step
        if (starHopsAllowed && isStarPosition(pos)) {
            const currentStarIndex = STAR_POSITIONS.indexOf(pos);
            if (currentStarIndex !== -1) {
                const nextStarIndex = (currentStarIndex + 1) % STAR_POSITIONS.length;
                const targetStarPos = STAR_POSITIONS[nextStarIndex];
                if (!wouldBlockSelf(allMarbles, movingIndex, targetStarPos)) {
                    // After a star hop, we remain allowed to hop further (looping permitted)
                    queue.push({ pos: targetStarPos, stepsLeft: stepsLeft - 1, starHopsAllowed: true });
                }
            }
        }
    }

    return Array.from(reachable);
}

/**
 * Check if a player has any valid moves with the current dice value
 */
function hasValidMoves(game, playerIndex, diceValue) {
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
}

/**
 * Roll a standard six-sided die
 */
function rollDice() {
    return Math.floor(Math.random() * 6) + 1;
}

module.exports = {
    getHomePositions,
    getStartPosition,
    isHomePosition,
    canMoveFromHome,
    wouldBlockSelf,
    getBasePositions,
    isStarPosition,
    getValidDestinations,
    hasValidMoves,
    rollDice,
};
