/**
 * Client refactoring instructions
 * 
 * The client.js file now has access to window.GameShared with:
 * - STAR_POSITIONS, CENTER_POSITION, BOT_NAMES, etc.
 * - getHomePositions(), getStartPosition(), isHomePosition()
 * - canMoveFromHome(), wouldBlockSelf(), isStarPosition()
 * - getValidDestinations(), hasValidMoves(), rollDice()
 * 
 * Steps to complete client refactoring:
 * 1. Remove duplicate constants (STAR_POSITIONS, CENTER_POSITION)
 * 2. Remove duplicate functions (getHomePositions, getStartPosition, etc.)
 * 3. Update all references to use window.GameShared.functionName()
 * 4. Test the game end-to-end
 * 
 * Lines to remove from client.js:
 * - Line 6: const CENTER_POSITION = 999;
 * - Lines 260-300: Duplicate game helper functions
 * - Lines 330-432: Duplicate getValidDestinations function
 * 
 * Update references:
 * - CENTER_POSITION -> GameShared.CENTER_POSITION
 * - getHomePositions(i) -> GameShared.getHomePositions(i)
 * - getStartPosition(i) -> GameShared.getStartPosition(i)
 * - isHomePosition(pos, i) -> GameShared.isHomePosition(pos, i)
 * - canMoveFromHome(val) -> GameShared.canMoveFromHome(val)
 * - getValidDestinations(...) -> GameShared.getValidDestinations(...)
 * - wouldBlockSelf(...) -> GameShared.wouldBlockSelf(...)
 * - isStarPosition(pos) -> GameShared.isStarPosition(pos)
 * - STAR_POSITIONS -> GameShared.STAR_POSITIONS
 */
