/**
 * Test Bot - Simulates a player to test action queue and game visualization
 * 
 * Bot behaviors:
 * - Random movement towards treasures (auto-collected on arrival)
 * - Return to base when carrying treasure (auto-dropped on arrival)
 * - Place traps randomly
 * - Rest when energy is low
 * 
 * Note: Treasure collection and dropping are automatic - no explicit actions needed.
 * The game engine handles treasure pickup when moving to a treasure cell,
 * and treasure drop when moving to base cell.
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Represents a 2D position on the game map.
 */
interface Position {
  x: number;
  y: number;
}

/**
 * Bot configuration settings.
 */
interface BotConfig {
  /** Unique identifier for the game to join */
  gameId: string;
  /** Player identifier (matches team code or playerId in game) */
  playerId: string;
  /** Base URL for game API (e.g., 'http://localhost:3000/api') */
  apiUrl: string;
  /** Milliseconds between each action execution */
  actionInterval: number;
}

/**
 * Static game configuration - fetched once at game start, never changes.
 */
interface GameConfig {
  /** Map dimensions */
  width: number;
  height: number;
  /** Static terrain layout: -1 = island, 0 = sea */
  terrain: number[][];
  /** Base positions for each player (indexed by player number) */
  bases: Position[];
  /** Game settings */
  settings: {
    /** Whether traps are enabled in this game */
    enableTraps?: boolean;
  };
}

/**
 * Dynamic game state - refreshed frequently as game progresses.
 */
interface GameState {
  /** 2D array of treasure values at each position (changes as treasures are collected) */
  treasures: number[][];
  /** 2D array of wave intensity (0-5) at each position */
  waves: number[][];
  /** All players in the game with current positions and stats */
  players: Array<{
    /** Legacy player code identifier */
    code?: string;
    /** Current player identifier */
    playerId?: string;
    /** Current position on map */
    position: Position;
    /** Current energy level */
    energy: number;
    /** Total score accumulated */
    score: number;
    /** Treasure value currently being carried (0 if none) */
    carriedTreasure?: number;
  }>;
  /** Current turn number */
  currentTurn: number;
  /** Game status: 'waiting', 'playing', or 'finished' */
  status: string;
}

/**
 * TestBot - Autonomous game player for testing and demonstration.
 * 
 * Features:
 * - Connects to game server via HTTP API
 * - Executes actions based on predefined strategies
 * - Automatic treasure collection on movement
 * - Automatic treasure drop when reaching base
 * - Random trap placement for strategic gameplay
 * - Automatically manages energy and navigation
 * - Stops gracefully when game ends or interrupted
 * 
 * Strategy Overview:
 * 1. Rest when energy is critically low
 * 2. Return to base when carrying treasure (auto-drop)
 * 3. Move towards nearest treasure (auto-collect)
 * 4. Randomly place traps (10% chance)
 * 5. Return to base when no treasures left
 */
class TestBot {
  private config: BotConfig;
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;
  
  // Static game configuration (fetched once)
  private gameConfig?: GameConfig;
  private basePosition?: Position;
  
  // Dynamic game state (refreshed frequently)
  private gameState?: GameState;
  private myPlayer?: any;

  /**
   * Creates a new TestBot instance.
   * 
   * @param config - Bot configuration containing gameId, playerId, apiUrl, and actionInterval
   */
  constructor(config: BotConfig) {
    this.config = config;
  }

  /**
   * Starts the bot's main loop.
   * 
   * Steps:
   * 1. Fetches static game configuration (terrain, bases, settings)
   * 2. Fetches initial game state (players, treasures, waves)
   * 3. Sets up interval timer to execute actions periodically
   * 4. Logs startup confirmation
   * 
   * The bot will continue running until stop() is called or the game ends.
   */
  async start() {
    console.log(`🤖 Bot starting for player ${this.config.playerId} in game ${this.config.gameId}`);
    this.running = true;

    // Fetch static game configuration once
    await this.fetchGameConfig();
    
    // Fetch initial dynamic state
    await this.fetchGameState();

    // Start action loop
    this.intervalId = setInterval(() => {
      this.executeAction();
    }, this.config.actionInterval);

    console.log(`✅ Bot started with ${this.config.actionInterval}ms interval`);
  }

  /**
   * Stops the bot and cleans up resources.
   * 
   * - Sets running flag to false
   * - Clears the action interval timer
   * - Logs shutdown confirmation
   */
  stop() {
    console.log(`🛑 Bot stopping...`);
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log(`✅ Bot stopped`);
  }

  /**
   * Fetches static game configuration once at startup.
   * Uses new /game/:gameId/config endpoint.
   * 
   * Updates:
   * - this.gameConfig - Static configuration (terrain, bases, settings)
   * - this.basePosition - Bot's home base position
   */
  private async fetchGameConfig() {
    try {
      const configResponse = await axios.get(`${this.config.apiUrl}/game/${this.config.gameId}/config`);
      
      this.gameConfig = {
        width: configResponse.data.width,
        height: configResponse.data.height,
        terrain: configResponse.data.terrain,
        bases: configResponse.data.bases || [],
        settings: configResponse.data.settings || { enableTraps: true }
      };
      
      console.log(`⚙️ Game config loaded: ${this.gameConfig.width}x${this.gameConfig.height}, enableTraps=${this.gameConfig.settings.enableTraps}`);
      
      // Set base position based on player index
      // Will be determined after first state fetch when we know player list
      
    } catch (error: any) {
      console.error(`❌ Error fetching game config:`, error.response?.data?.error || error.message);
    }
  }

  /**
   * Fetches dynamic game state from the server.
   * Uses new /game/:gameId/state endpoint that combines all dynamic data.
   * 
   * Updates:
   * - this.gameState - Current treasures, players, status, turn
   * - this.myPlayer - Reference to this bot's player object
   * - this.basePosition - Set on first fetch after knowing player index
   */
  private async fetchGameState() {
    try {
      const stateResponse = await axios.get(`${this.config.apiUrl}/game/${this.config.gameId}/state`);
      
      this.gameState = {
        treasures: stateResponse.data.treasures,
        waves: stateResponse.data.waves || [],
        players: stateResponse.data.players || [],
        currentTurn: stateResponse.data.currentTurn || 0,
        status: stateResponse.data.status || 'unknown'
      };
      
      // Find my player
      this.myPlayer = this.gameState.players.find(p => 
        (p.code === this.config.playerId) || (p.playerId === this.config.playerId)
      );
      
      // Set base position on first fetch
      if (!this.basePosition && this.gameConfig?.bases && this.gameState.players.length > 0) {
        const playerIndex = this.gameState.players.findIndex(p => 
          (p.code === this.config.playerId) || (p.playerId === this.config.playerId)
        );
        if (playerIndex >= 0 && playerIndex < this.gameConfig.bases.length) {
          const base = this.gameConfig.bases[playerIndex];
          this.basePosition = Array.isArray(base) 
            ? { x: base[0], y: base[1] } 
            : { x: base.x, y: base.y };
          console.log(`🏠 Base position set to (${this.basePosition.x}, ${this.basePosition.y}) for player ${playerIndex}`);
        }
      }
      
      // Count treasures and log positions
      let treasureCount = 0;
      const treasurePositions: Position[] = [];
      if (this.gameConfig) {
        for (let y = 0; y < this.gameConfig.height; y++) {
          for (let x = 0; x < this.gameConfig.width; x++) {
            if (this.gameState.treasures[y]?.[x] > 0) {
              treasureCount++;
              treasurePositions.push({ x, y });
            }
          }
        }
      }

      if (treasurePositions.length > 0) {
        console.log(`💎 Treasure positions:`, treasurePositions.slice(0, 5).map(p => `(${p.x},${p.y})`).join(', '), treasurePositions.length > 5 ? `... +${treasurePositions.length - 5} more` : '');
      }
      console.log(`📊 Turn ${this.gameState.currentTurn} | Pos: (${this.myPlayer?.position.x},${this.myPlayer?.position.y}) | Energy: ${this.myPlayer?.energy} | Score: ${this.myPlayer?.score || 0} | Carried: ${this.myPlayer?.carriedTreasure || 0} | Available: ${treasureCount}`);
      
    } catch (error: any) {
      console.error(`❌ Error fetching game state:`, error.response?.data?.error || error.message);
    }
  }

  /**
   * Main action execution loop (called every actionInterval ms).
   * 
   * Flow:
   * 1. Validates bot is ready and game is still running
   * 2. Checks if game has finished, stops bot if true
   * 3. Refreshes game state every 5 turns
   * 4. Decides next action based on current strategy
   * 5. Sends action to server
   * 
   * Automatically stops bot when game status is 'finished'.
   */
  private async executeAction() {
    if (!this.running || !this.gameState || !this.myPlayer) {
      console.log(this.running, this.myPlayer);
      console.log(`⚠️  Bot not ready to execute action`);
      return;
    }

    // Kiểm tra game status - dừng nếu game kết thúc
    if (this.gameState.status === 'finished') {
      console.log('🏁 Game finished, stopping bot...');
      this.stop();
      return;
    }

    try {
      // Always refresh game state before deciding action to get latest position
      await this.fetchGameState();
      
      // Kiểm tra lại sau khi refresh
      if (this.gameState?.status === 'finished') {
        console.log('🏁 Game finished, stopping bot...');
        this.stop();
        return;
      }

      const action = this.decideAction();
      
      if (action) {
        console.log(`🎮 Bot action: ${action.type}`, action.data || '');
        await this.sendAction(action);
      }

    } catch (error: any) {
      console.error(`❌ Error executing action:`, error.message);
    }
  }

  /**
   * Decides the next action based on bot's current state and strategy priorities.
   * 
   * Strategy priorities (in order):
   * 1. Rest - if energy < 20 (critical low)
   * 2. Return to base - if carrying treasure (auto-drops on arrival)
   * 3. Move to nearest treasure - navigate and auto-collect
   * 4. Place trap - 10% random chance if enabled and energy > 30
   * 5. Random move - fallback if no other action applicable
   * 
   * Flow: Find treasure → Move to it → Auto-collect → Return to base → Auto-drop → Repeat
   * 
   * @returns Action object with type and optional data, or null if no action
   */
  private decideAction(): { type: string; data?: any } | null {
    if (!this.gameState || !this.myPlayer || !this.gameConfig) return null;

    const { position, energy, carriedTreasure } = this.myPlayer;

    // ============================================================
    // ACTION 1: REST
    // Endpoint: POST /game/:gameId/player/:playerId/rest
    // Purpose: Restore energy when critically low
    // Energy cost: 0 (gains energy instead)
    // ============================================================
    if (energy < 20) {
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
    if (carriedTreasure && carriedTreasure > 0 && this.basePosition) {
      // Return to base to score points
      const direction = this.getDirectionTowards(position, this.basePosition);
      console.log(`💰 Carrying treasure=${carriedTreasure}, returning to base at (${this.basePosition.x}, ${this.basePosition.y})...`);
      return { type: 'move', data: { direction } };
    }

    // ============================================================
    // ACTION 3: MOVE (towards treasure)
    // Purpose: Navigate to nearest available treasure to collect it
    // Note: Only looks for treasures not yet collected (value > 0 in current map state)
    // Treasure is automatically picked up when reaching the cell
    // Priority: HIGH when not carrying treasure
    // ============================================================
    const nearestTreasure = this.findNearestTreasure(position);
    if (nearestTreasure) {
      const direction = this.getDirectionTowards(position, nearestTreasure);
      console.log(`🎯 Moving towards treasure at (${nearestTreasure.x}, ${nearestTreasure.y})`);
      return { type: 'move', data: { direction } };
    } else {
      // ============================================================
      // NO TREASURES LEFT: Return to base and stay
      // Purpose: When all treasures collected, return home and rest
      // ============================================================
      if (this.basePosition) {
        const atBase = position.x === this.basePosition.x && position.y === this.basePosition.y;
        if (atBase) {
          console.log(`🏠 At base, no treasures left - resting`);
          return { type: 'rest' };
        } else {
          const direction = this.getDirectionTowards(position, this.basePosition);
          console.log(`🏠 No treasures left, returning to base at (${this.basePosition.x}, ${this.basePosition.y})`);
          return { type: 'move', data: { direction } };
        }
      }
    }

    // ============================================================
    // ACTION 4: PLACE TRAP
    // Endpoint: POST /game/:gameId/player/:playerId/trap
    // Purpose: Place a trap at current position to damage other players
    // Data: { position: {x, y}, danger: number }
    // Requirements:
    //   - Traps must be enabled in game settings
    //   - Energy > 30 (needs sufficient energy)
    //   - Can only place at current position (not adjacent)
    //   - Cannot place on: islands, treasures, or bases
    // Energy cost: Equal to danger value (30% of current energy, max 20)
    // Probability: 10% random chance per action
    // Effect: Creates trap that damages other players who step on it
    // ============================================================
    const enableTraps = this.gameConfig.settings?.enableTraps ?? true;
    const trapRoll = Math.random();
    if (enableTraps && energy > 30 && trapRoll < 0.1) {
      console.log(`🎲 Trap roll: ${trapRoll.toFixed(2)} < 0.1 - attempting to place trap`);
      
      // Chỉ đặt bẫy tại vị trí hiện tại
      const trapPos = position;
      
      // Validate position
      let canPlace = true;
      
      // Không đặt trên đảo
      if (this.gameConfig.terrain[trapPos.y]?.[trapPos.x] === -1) {
        console.log(`  ❌ Current position is island`);
        canPlace = false;
      }
      
      // Không đặt trên kho báu
      const treasureValue = this.gameState.treasures[trapPos.y]?.[trapPos.x];
      if (treasureValue !== undefined && treasureValue !== 0) {
        console.log(`  ❌ Current position has treasure (${treasureValue})`);
        canPlace = false;
      }
      
      // Không đặt trên base
      const baseAtPos = this.gameConfig.bases?.find((b: any) => {
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
        console.log(`✅ Placing trap at current position (${trapPos.x}, ${trapPos.y}) with danger ${danger}`);
        return { 
          type: 'trap', 
          data: { 
            position: trapPos,
            danger 
          } 
        };
      } else {
        console.log(`❌ Cannot place trap at current position`);
      }
    }

    // ============================================================
    // FALLBACK: REST (if no base position found)
    // Purpose: Stay safe when no clear goal
    // ============================================================
    console.log(`⚠️ No valid action found - resting`);
    return { type: 'rest' };
  }

  /**
   * Finds the nearest available treasure on the map using Manhattan distance.
   * Only searches for treasures with value > 0 (not yet collected).
   * 
   * The map state is updated from server, so collected treasures (value = 0)
   * are automatically excluded from search.
   * 
   * @param from - Starting position to search from
   * @returns Position of nearest treasure, or null if no treasure found
   */
  private findNearestTreasure(from: Position): Position | null {
    if (!this.gameState || !this.gameConfig) return null;

    const treasures = this.gameState.treasures;
    const { width, height } = this.gameConfig;
    let nearest: Position | null = null;
    let minDistance = Infinity;
    let availableTreasures = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (treasures[y][x] > 0) {
          availableTreasures++;
          const distance = Math.abs(x - from.x) + Math.abs(y - from.y);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = { x, y };
          }
        }
      }
    }

    if (availableTreasures > 0) {
      console.log(`📍 Found ${availableTreasures} available treasures, nearest at (${nearest?.x}, ${nearest?.y}) distance=${minDistance}`);
    } else {
      console.log(`📍 No treasures available on map`);
    }

    return nearest;
  }

  /**
   * Determines the best cardinal direction to move towards a target.
   * Uses greedy approach: prioritizes the axis with larger distance.
   * 
   * Coordinate system:
   * - X increases to the right (east)
   * - Y increases downward (south)
   * 
   * @param from - Current position
   * @param to - Target position
   * @returns Direction string: 'north', 'south', 'east', or 'west'
   */
  private getDirectionTowards(from: Position, to: Position): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    console.log(`🧭 Navigation: from (${from.x}, ${from.y}) to (${to.x}, ${to.y}) | dx=${dx}, dy=${dy}`);

    // Prioritize the larger difference
    if (Math.abs(dx) > Math.abs(dy)) {
      const direction = dx > 0 ? 'east' : 'west';
      console.log(`   → Moving ${direction} (horizontal priority)`);
      return direction;
    } else {
      // Y increases downward, so dy > 0 means target is south
      const direction = dy > 0 ? 'south' : 'north';
      console.log(`   → Moving ${direction} (vertical priority)`);
      return direction;
    }
  }

  /**
   * Sends an action to the game server via HTTP API.
   * 
   * Action Types and Endpoints:
   * - move: POST /game/:gameId/player/:playerId/move
   * - rest: POST /game/:gameId/player/:playerId/rest
   * - trap: POST /game/:gameId/player/:playerId/trap
   * 
   * Note: pick-treasure and drop-treasure actions are automatic
   * and handled by the game engine during movement.
   * 
   * @param action - Action object with type and optional data
   */
  private async sendAction(action: { type: string; data?: any }) {
    try {
      const endpoint = `${this.config.apiUrl}/game/${this.config.gameId}/player/${this.config.playerId}/${action.type}`;
      console.log(`📤 Sending to: ${endpoint}`);
      console.log(`📤 Player ID: ${this.config.playerId}`);
      if (action.data) {
        console.log(`📤 Action data:`, JSON.stringify(action.data));
      }
      await axios.post(endpoint, action.data || {});
    } catch (error: any) {
      console.error(`❌ Error sending action:`, error.response?.data?.error || error.message);
    }
  }
}

// ============================================================
// CLI Entry Point
// ============================================================

/**
 * Command Line Interface for TestBot
 * 
 * Usage:
 *   npm start <gameId>
 * 
 * Environment Variables (.env):
 *   PLAYER_ID       - Bot's player identifier (default: 'team_alpha')
 *   API_URL         - Game server API endpoint (default: 'http://localhost:3000/api')
 *   ACTION_INTERVAL - Milliseconds between actions (default: 1000)
 * 
 * Examples:
 *   npm start game-001
 *   npm start test001
 * 
 * The bot will:
 * 1. Connect to the specified game
 * 2. Execute actions every ACTION_INTERVAL milliseconds
 * 3. Run until game ends or CTRL+C is pressed
 */

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log(`
Usage: npm start <gameId>

Configuration is loaded from .env file:
  PLAYER_ID     - Your player ID (e.g., team_alpha)
  API_URL       - API endpoint URL (default: http://localhost:3000/api)
  ACTION_INTERVAL - Milliseconds between actions (default: 1000)

Examples:
  npm start game-001
  npm start test001
  `);
  process.exit(1);
}

// Parse configuration from environment and arguments
const [gameId] = args;
const playerId = process.env.PLAYER_ID || 'team_alpha';
const apiUrl = process.env.API_URL || 'http://localhost:3000/api';
const actionInterval = parseInt(process.env.ACTION_INTERVAL || '1000');

// Create and configure bot instance
const bot = new TestBot({
  gameId,
  playerId,
  apiUrl,
  actionInterval
});

// Log startup configuration
console.log(`🤖 Starting Test Bot`);
console.log(`   Game ID: ${gameId}`);
console.log(`   Player ID: ${playerId}`);
console.log(`   API URL: ${apiUrl}`);
console.log(`   Interval: ${actionInterval}ms`);

// Start bot main loop
bot.start();

/**
 * Graceful shutdown handler
 * Catches SIGINT (CTRL+C) and stops bot cleanly
 */
process.on('SIGINT', () => {
  console.log('\n⚠️  Received SIGINT, stopping bot...');
  bot.stop();
  process.exit(0);
});

export default TestBot;
