/**
 * Bot Action Decision Strategy
 * Defines how the bot decides what action to take each turn
 */

import { Position, GameConfig, GameState } from './types';

/**
 * Strategy context - contains all information needed to make a decision
 */
export interface StrategyContext {
  myPlayer: {
    position: Position;
    energy: number;
    carriedTreasure?: number;
  };
  basePosition: Position | null;
  gameConfig: GameConfig;
  gameState: GameState;
}

/**
 * Action decision result
 */
export interface ActionDecision {
  type: string;
  data?: any;
}

/**
 * Helper: Check if a position is valid (not island)
 */
function isValidMove(context: StrategyContext, pos: Position): boolean {
  const { gameConfig } = context;
  if (pos.x < 0 || pos.x >= gameConfig.width || 
      pos.y < 0 || pos.y >= gameConfig.height) return false;
  // -1 = island (blocked), 0+ = sea (passable)
  const terrain = gameConfig.terrain[pos.y]?.[pos.x];
  return terrain !== -1;
}

/**
 * Helper: Find nearest treasure using Manhattan distance
 */
function findNearestTreasure(context: StrategyContext, from: Position): Position | null {
  const { gameState, gameConfig } = context;
  const treasures = gameState.treasures;
  const { width, height } = gameConfig;
  let nearest: Position | null = null;
  let minDistance = Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (treasures[y][x] > 0) {
        const distance = Math.abs(x - from.x) + Math.abs(y - from.y);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = { x, y };
        }
      }
    }
  }

  return nearest;
}

/**
 * Helper: Calculate distance to target (Manhattan)
 */
function getDistance(from: Position, to: Position): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

/**
 * Helper: Get direction towards target, avoiding islands and loops
 * 
 * Strategy:
 * 1. Try primary direction (moving towards target)
 * 2. Try perpendicular directions (both moving towards target)
 * 3. Try any valid direction that doesn't increase distance (lateral moves)
 * 4. As last resort, accept any valid move
 * 
 * This prevents the bot from oscillating by prioritizing moves that get closer
 */
function getDirectionTowards(context: StrategyContext, from: Position, to: Position): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const currentDistance = getDistance(from, to);

  console.log(`🧭 Navigation: from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) | distance=${currentDistance}`);

  // Build direction list with priorities
  interface DirectionOption {
    direction: string;
    pos: Position;
    priority: number; // Lower = better
    distanceChange: number; // How much closer/farther this move takes us
  }

  const options: DirectionOption[] = [];

  // Helper to evaluate a direction
  const evaluateDirection = (direction: string, pos: Position, priority: number) => {
    if (isValidMove(context, pos)) {
      const newDistance = getDistance(pos, to);
      const distanceChange = newDistance - currentDistance;
      options.push({ direction, pos, priority, distanceChange });
    }
  };

  // Primary direction (larger difference)
  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal priority
    if (dx > 0) {
      evaluateDirection('east', { x: from.x + 1, y: from.y }, 0);
    } else {
      evaluateDirection('west', { x: from.x - 1, y: from.y }, 0);
    }
    // Perpendicular (vertical)
    if (dy > 0) {
      evaluateDirection('south', { x: from.x, y: from.y + 1 }, 1);
    } else if (dy < 0) {
      evaluateDirection('north', { x: from.x, y: from.y - 1 }, 1);
    }
  } else {
    // Vertical priority
    if (dy > 0) {
      evaluateDirection('south', { x: from.x, y: from.y + 1 }, 0);
    } else {
      evaluateDirection('north', { x: from.x, y: from.y - 1 }, 0);
    }
    // Perpendicular (horizontal)
    if (dx > 0) {
      evaluateDirection('east', { x: from.x + 1, y: from.y }, 1);
    } else if (dx < 0) {
      evaluateDirection('west', { x: from.x - 1, y: from.y }, 1);
    }
  }

  // Add remaining directions with lower priority
  evaluateDirection('north', { x: from.x, y: from.y - 1 }, 2);
  evaluateDirection('south', { x: from.x, y: from.y + 1 }, 2);
  evaluateDirection('east', { x: from.x + 1, y: from.y }, 2);
  evaluateDirection('west', { x: from.x - 1, y: from.y }, 2);

  // Remove duplicates (keep first occurrence only)
  const seen = new Set<string>();
  const uniqueOptions = options.filter(opt => {
    if (seen.has(opt.direction)) return false;
    seen.add(opt.direction);
    return true;
  });

  if (uniqueOptions.length === 0) {
    console.log(`   ⚠️  All directions blocked!`);
    // Return any direction as fallback (should not happen in normal gameplay)
    return 'rest';
  }

  // Sort by: priority first, then prefer moves that get closer (distanceChange < 0)
  uniqueOptions.sort((a, b) => {
    // First: lower priority number
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Second: prefer moves that get closer
    if (a.distanceChange !== b.distanceChange) {
      return a.distanceChange - b.distanceChange;
    }
    return 0;
  });

  const chosen = uniqueOptions[0];
  const status = chosen.distanceChange < 0 ? '✅ closer' : chosen.distanceChange === 0 ? '⟲ same dist' : '⚠️ farther';
  console.log(`   ${status} Moving ${chosen.direction} (dist change: ${chosen.distanceChange >= 0 ? '+' : ''}${chosen.distanceChange})`);
  return chosen.direction;
}

/**
 * Main strategy decision function
 * 
 * Strategy priorities (in order):
 * 1. Rest - if energy < 20 (critical low)
 * 2. Return to base - if carrying treasure (auto-drops on arrival)
 * 3. Place trap - 20% random chance if enabled and energy > 30
 * 4. Move to nearest treasure - navigate and auto-collect
 * 5. Random move - fallback if no other action applicable
 * 
 * @param context - Strategy context with all game state
 * @returns Action decision with type and optional data
 */
export function decideAction(context: StrategyContext): ActionDecision | null {
  const { myPlayer, gameConfig, gameState, basePosition } = context;
  const { position, energy, carriedTreasure } = myPlayer;

  // Check if game is still playing
  if (gameState.status !== 'playing') {
    console.log(`⏸️ Game not playing (status: ${gameState.status}), resting... Turn: ${gameState.currentTurn}`);
    return { type: 'rest' };
  }

  // ============================================================
  // ACTION 1: REST
  // Endpoint: POST /game/:gameId/player/:playerId/rest
  // Purpose: Restore energy when critically low
  // Energy cost: 0 (gains energy instead)
  // ============================================================
  if (energy < 20) {
    console.log(`⚡ Energy critically low (${energy} < 20), resting...`);
    return { type: 'rest' };
  }

  // ============================================================
  // ACTION 2: MOVE (towards base)
  // Endpoint: POST /game/:gameId/player/:playerId/move
  // Purpose: Navigate back to base when carrying treasure
  // Data: { direction: 'north' | 'south' | 'east' | 'west' }
  // Energy cost: 1 + wave value at destination
  // Note: Treasure is automatically dropped when reaching base
  // Priority: HIGHEST when carrying treasure
  // ============================================================
  if (carriedTreasure && carriedTreasure > 0 && basePosition) {
    // Return to base to score points
    const direction = getDirectionTowards(context, position, basePosition);
    console.log(`💰 Carrying treasure=${carriedTreasure}, returning to base at (${basePosition.x}, ${basePosition.y})...`);
    return { type: 'move', data: { direction } };
  }

  // ============================================================
  // ACTION 3b: PLACE TRAP (BEFORE moving - higher priority)
  // Endpoint: POST /game/:gameId/player/:playerId/trap
  // Purpose: Place a trap at current position to damage other players
  // Data: { position: {x, y}, danger: number }
  // Requirements:
  //   - Traps must be enabled in game settings
  //   - Energy > 30 (needs sufficient energy)
  //   - Can only place at current position (not adjacent)
  //   - Cannot place on: islands, treasures, or bases
  // Energy cost: Equal to danger value (30% of current energy, max 20)
  // Probability: 20% random chance per action
  // Effect: Creates trap that damages other players who step on it
  // ============================================================
  const enableTraps = gameConfig.settings?.enableTraps ?? true;
  const trapRoll = Math.random();
  console.log(`🎲 Trap roll: ${trapRoll.toFixed(4)} (enableTraps=${enableTraps}, energy=${energy})`);
  
  if (enableTraps && energy > 30 && trapRoll < 0.2) { // 20% chance
    console.log(`✅ Trap roll passed (${trapRoll.toFixed(4)} < 0.2) - attempting to place trap`);
    
    // Chỉ đặt bẫy tại vị trí hiện tại
    const trapPos = position;
    
    // Validate position
    let canPlace = true;
    
    // Không đặt trên đảo
    if (gameConfig.terrain[trapPos.y]?.[trapPos.x] === -1) {
      console.log(`  ❌ Current position is island`);
      canPlace = false;
    }
    
    // Không đặt trên kho báu
    const treasureValue = gameState.treasures[trapPos.y]?.[trapPos.x];
    if (treasureValue !== undefined && treasureValue !== 0) {
      console.log(`  ❌ Current position has treasure (${treasureValue})`);
      canPlace = false;
    }
    
    // Không đặt trên base
    const baseAtPos = gameConfig.bases?.find((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x;
      const by = Array.isArray(b) ? b[1] : b.y;
      return bx === trapPos.x && by === trapPos.y;
    });
    if (baseAtPos) {
      console.log(`  ❌ Current position is base`);
      canPlace = false;
    }
    
    if (canPlace) {
      const danger = Math.min(20, Math.floor(energy * 0.3)); // 30% energy, max 20
      console.log(`💣 Placing trap at current position (${trapPos.x}, ${trapPos.y}) with danger ${danger}`);
      return { 
        type: 'trap', 
        data: { 
          position: trapPos,
          danger 
        } 
      };
    } else {
      console.log(`❌ Cannot place trap at current position - moving instead`);
    }
  }

  // ============================================================
  // ACTION 3: MOVE (towards treasure)
  // Purpose: Navigate to nearest available treasure to collect it
  // Note: Only looks for treasures not yet collected (value > 0 in current map state)
  // Treasure is automatically picked up when reaching the cell
  // Priority: HIGH when not carrying treasure
  // ============================================================
  const nearestTreasure = findNearestTreasure(context, position);
  if (nearestTreasure) {
    const direction = getDirectionTowards(context, position, nearestTreasure);
    console.log(`🎯 Moving towards treasure at (${nearestTreasure.x}, ${nearestTreasure.y})`);
    return { type: 'move', data: { direction } };
  } else {
    // ============================================================
    // NO TREASURES LEFT: Return to base and stay
    // Purpose: When all treasures collected, return home and rest
    // ============================================================
    if (basePosition) {
      const atBase = position.x === basePosition.x && position.y === basePosition.y;
      if (atBase) {
        console.log(`🏠 At base, no treasures left - resting`);
        return { type: 'rest' };
      } else {
        const direction = getDirectionTowards(context, position, basePosition);
        console.log(`🏠 No treasures left, returning to base at (${basePosition.x}, ${basePosition.y})`);
        return { type: 'move', data: { direction } };
      }
    }
  }

  // ============================================================
  // FALLBACK: REST (if no base position found)
  // Purpose: Stay safe when no clear goal
  // ============================================================
  console.log(`⚠️ No valid action found - resting`);
  return { type: 'rest' };
}
