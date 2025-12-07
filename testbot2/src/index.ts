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
import { Position, BotConfig, GameConfig, GameState } from './types';
import { decideAction, StrategyContext } from './strategy';
import { ApiEndpoints } from './api-endpoints';

// Load environment variables
dotenv.config();

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
  private api: ApiEndpoints;
  
  // Static game configuration (fetched once)
  private gameConfig?: GameConfig;
  private basePosition?: Position;
  
  // Dynamic game state (refreshed frequently)
  private gameState?: GameState;
  private myPlayer?: any;

  // Movement history tracking to prevent loops
  private moveHistory: Array<{ position: Position; turn: number }> = [];
  private lastDirection?: string;
  private directionChangeCounter: number = 0;
  private breakLoopAttempt: number = 0; // Track loop-breaking attempts
  private readonly MAX_SAME_DIRECTION_TURNS = 8; // Max turns in same direction before considering stuck
  private readonly HISTORY_SIZE = 15; // Track last N positions

  /**
   * Creates a new TestBot instance.
   * 
   * @param config - Bot configuration containing gameId, playerId, apiUrl, and actionInterval
   */
  constructor(config: BotConfig) {
    this.config = config;
    this.api = new ApiEndpoints(config.apiUrl);
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
      const endpoint = this.api.getGameConfig(this.config.gameId, this.config.playerId);
      const configResponse = await axios.get(endpoint);
      
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
      const endpoint = this.api.getGameState(this.config.gameId, this.config.playerId);
      const stateResponse = await axios.get(endpoint);
      
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
   * 4. Detects if stuck in movement loop and applies corrective action
   * 5. Decides next action based on current strategy
   * 6. Sends action to server
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

      // Track movement history
      if (this.myPlayer?.position) {
        this.moveHistory.push({
          position: { ...this.myPlayer.position },
          turn: this.gameState?.currentTurn || 0
        });
        
        // Keep only last 20 moves
        if (this.moveHistory.length > 20) {
          this.moveHistory.shift();
        }
      }

      // Check if stuck in loop - if yes, apply corrective action
      if (this.isStuckInLoop()) {
        console.log(`🛑 Stuck loop detected! Current position: (${this.myPlayer.position.x}, ${this.myPlayer.position.y})`);
        console.log(`📍 Move history (last 10):`, this.moveHistory.slice(-10).map(h => `(${h.position.x},${h.position.y})`).join(' -> '));
        
        // Try different strategies to break free:
        // 1. Rest to reset and recover energy
        // 2. On next detection, try going to treasures instead of base
        // 3. On next detection, just rest aggressively
        
        if (!this.breakLoopAttempt) {
          this.breakLoopAttempt = 0;
        }
        this.breakLoopAttempt++;
        
        if (this.breakLoopAttempt === 1) {
          console.log(`💤 Attempt 1: Resting to break the loop...`);
          await this.sendAction({ type: 'rest' });
        } else if (this.breakLoopAttempt === 2) {
          console.log(`💪 Attempt 2: Pushing through with aggressive movement...`);
          // Force a movement in a new direction
          const directions = ['north', 'south', 'east', 'west'];
          const randomDir = directions[Math.floor(Math.random() * directions.length)];
          await this.sendAction({ type: 'move', data: { direction: randomDir } });
        } else {
          console.log(`😴 Attempt ${this.breakLoopAttempt}: Extended rest to recover...`);
          await this.sendAction({ type: 'rest' });
        }
        
        // Clear direction history after breaking the loop
        this.lastDirection = undefined;
        this.directionChangeCounter = 0;
        this.moveHistory = [];
        
        return;
      } else {
        // Reset break loop attempt counter when we're no longer stuck
        this.breakLoopAttempt = 0;
      }

      const action = this.decideAction();
      
      if (action) {
        console.log(`🎮 Bot action: ${action.type}`, action.data || '');
        console.log(`   Game status: ${this.gameState?.status}, Turn: ${this.gameState?.currentTurn}`);
        await this.sendAction(action);
      }

    } catch (error: any) {
      console.error(`❌ Error executing action:`, error.message);
    }
  }

  /**
   * Decides the next action using the strategy module.
   * Delegates to the exported decideAction function from strategy.ts
   * 
   * @returns Action object with type and optional data, or null if no action
   */
  private decideAction(): { type: string; data?: any } | null {
    if (!this.gameState || !this.myPlayer || !this.gameConfig) return null;

    const context: StrategyContext = {
      myPlayer: {
        position: this.myPlayer.position,
        energy: this.myPlayer.energy,
        carriedTreasure: this.myPlayer.carriedTreasure
      },
      basePosition: this.basePosition || null,
      gameConfig: this.gameConfig,
      gameState: this.gameState
    };

    const action = decideAction(context);

    // Track movement to detect loops
    if (action?.type === 'move' && action.data?.direction) {
      this.trackMovement(action.data.direction);
    }

    return action;
  }

  /**
   * Tracks movement history to detect stuck patterns
   * If bot is stuck repeating the same direction, force a rest/detour
   */
  private trackMovement(direction: string) {
    // Check if direction changed
    if (this.lastDirection !== direction) {
      this.lastDirection = direction;
      this.directionChangeCounter = 0;
    } else {
      this.directionChangeCounter++;
    }

    // Log repetitive movement warning
    if (this.directionChangeCounter > 3) {
      console.log(`⚠️  ⚠️  STUCK WARNING: Moving ${direction} for ${this.directionChangeCounter + 1} consecutive turns`);
    }

    // Record current position
    if (this.myPlayer) {
      this.moveHistory.push({
        position: { ...this.myPlayer.position },
        turn: this.gameState?.currentTurn || 0
      });

      // Keep only recent history
      if (this.moveHistory.length > this.HISTORY_SIZE) {
        this.moveHistory.shift();
      }
    }
  }

  /**
   * Detects if the bot is stuck in a repeating movement pattern
   * Returns true if bot has been cycling through same positions
   */
  private isStuckInLoop(): boolean {
    if (this.moveHistory.length < 6) return false;

    // Check if we're cycling back to the same position repeatedly
    const recentPositions = this.moveHistory.slice(-6);
    const uniquePositions = new Set(
      recentPositions.map(h => `${h.position.x},${h.position.y}`)
    );

    // If we only visit 2-3 positions alternately, we're stuck in a loop
    if (uniquePositions.size <= 3) {
      // Further validation: check if first and last positions are same
      const firstPos = recentPositions[0];
      const lastPos = recentPositions[recentPositions.length - 1];
      if (firstPos.position.x === lastPos.position.x && 
          firstPos.position.y === lastPos.position.y) {
        console.log(`🔄 STUCK LOOP DETECTED: Cycling through ${uniquePositions.size} positions`);
        return true;
      }
    }

    // Also check if we haven't moved at all in last 5 turns
    const recentNoMove = this.moveHistory.slice(-5);
    if (recentNoMove.every(h => 
      h.position.x === recentNoMove[0].position.x && 
      h.position.y === recentNoMove[0].position.y
    )) {
      console.log(`🔒 STUCK DETECTED: No movement for 5 turns`);
      return true;
    }

    return false;
  }

  /**
   * Sends an action to the game server via HTTP API.
   * 
   * Action Types and Endpoints:
   * - move: POST /game/:gameId/player/:playerId/move
   * - rest: POST /game/:gameId/player/:playerId/rest
   * - trap: POST /game/:gameId/player/:playerId/trap
   * 
   * Note: Treasure is auto-collected on move and auto-dropped at base
   * Includes player-secret header for authentication
   * 
   * @param action - Action object with type and optional data
   */
  private async sendAction(action: { type: string; data?: any }) {
    try {
      // Use API manager to get endpoint
      let endpoint: string;
      switch (action.type) {
        case 'move':
          endpoint = this.api.postMove(this.config.gameId, this.config.playerId);
          break;
        case 'rest':
          endpoint = this.api.postRest(this.config.gameId, this.config.playerId);
          break;
        case 'trap':
          endpoint = this.api.postTrap(this.config.gameId, this.config.playerId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      console.log(`📤 Sending to: ${endpoint}`);
      console.log(`📤 Player ID: ${this.config.playerId}`);
      if (action.data) {
        console.log(`📤 Action data:`, JSON.stringify(action.data));
      }
      
      // ✅ NEW: Include player-secret header for authentication
      const playerSecret = process.env.PLAYER_SECRET;
      if (!playerSecret) {
        console.error(`❌ PLAYER_SECRET not set in environment`);
        return;
      }

      const response = await axios.post(endpoint, action.data || {}, {
        headers: {
          'player-secret': playerSecret
        }
      });
      console.log(`✅ Action ${action.type} accepted (status: ${response.status})`);
    } catch (error: any) {
      if (error.response) {
        console.error(`❌ Action failed - Status: ${error.response.status}, Error: ${error.response.data?.error || error.message}`);
      } else {
        console.error(`❌ Error sending action:`, error.message);
      }
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
