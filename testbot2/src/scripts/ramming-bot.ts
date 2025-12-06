/**
 * Ramming Bot - Tìm và đâm thuyền đối thủ
 * 
 * Hành vi:
 * - Tìm vị trí player đối thủ
 * - Di chuyển trực tiếp về phía đối thủ
 * - Va chạm để test collision mechanics
 * - Ưu tiên đối thủ gần nhất
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface Position {
  x: number;
  y: number;
}

interface PlayerInfo {
  playerId: string;
  code: string;
  position: Position;
  energy: number;
  score: number;
}

class RammingBot {
  private gameId: string;
  private playerId: string;
  private apiUrl: string;
  private actionInterval: number;
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;

  private myPosition?: Position;
  private myEnergy?: number;
  private basePosition?: Position;
  private terrain?: number[][];
  private enemies: PlayerInfo[] = [];
  private targetEnemy?: PlayerInfo;
  private consecutiveRamAttempts: number = 0;

  constructor(gameId: string, playerId: string, apiUrl: string, actionInterval: number = 1500) {
    this.gameId = gameId;
    this.playerId = playerId;
    this.apiUrl = apiUrl;
    this.actionInterval = actionInterval;
  }

  async start() {
    console.log(`💥 Ramming Bot starting for player ${this.playerId}`);
    this.running = true;

    await this.fetchGameConfig();
    await this.fetchGameState();

    this.intervalId = setInterval(() => {
      this.executeAction();
    }, this.actionInterval);

    console.log(`✅ Ramming Bot started - Looking for ships to ram!`);
  }

  stop() {
    console.log(`🛑 Ramming Bot stopping...`);
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log(`✅ Ramming Bot stopped`);
  }

  private async fetchGameConfig() {
    try {
      const response = await axios.get(`${this.apiUrl}/game/${this.gameId}/config`);
      this.terrain = response.data.terrain;
      
      const bases = response.data.bases || [];
      const players = await this.getPlayers();
      const playerIndex = players.findIndex((p: any) => p.code === this.playerId || p.playerId === this.playerId);
      
      if (playerIndex >= 0 && playerIndex < bases.length) {
        const base = bases[playerIndex];
        this.basePosition = Array.isArray(base) ? { x: base[0], y: base[1] } : base;
        if (this.basePosition) {
          console.log(`🏠 Base at (${this.basePosition.x}, ${this.basePosition.y})`);
        }
      }
    } catch (error: any) {
      console.error(`❌ Error fetching config:`, error.message);
    }
  }

  private async getPlayers() {
    try {
      const response = await axios.get(`${this.apiUrl}/game/${this.gameId}/state`);
      return response.data.players || [];
    } catch (error) {
      return [];
    }
  }

  private async fetchGameState() {
    try {
      const response = await axios.get(`${this.apiUrl}/game/${this.gameId}/state`);
      
      const players = response.data.players || [];
      const myPlayer = players.find((p: any) => p.code === this.playerId || p.playerId === this.playerId);
      
      if (myPlayer && myPlayer.position) {
        this.myPosition = myPlayer.position;
        this.myEnergy = myPlayer.energy || 100;
      }

      // Get enemy positions
      this.enemies = players
        .filter((p: any) => p.code !== this.playerId && p.playerId !== this.playerId)
        .map((p: any) => ({
          playerId: p.playerId || p.code,
          code: p.code,
          position: p.position,
          energy: p.energy || 100,
          score: p.score || 0
        }));

      if (this.enemies.length > 0) {
        console.log(`⚔️ Found ${this.enemies.length} enemies to ram!`);
      }

    } catch (error: any) {
      console.error(`❌ Error fetching state:`, error.message);
    }
  }

  private async executeAction() {
    if (!this.running) return;

    await this.fetchGameState();

    if (!this.myPosition) {
      console.log(`⏭️ No position info, skipping turn`);
      await this.sendAction('rest');
      return;
    }

    // Check energy - rest if too low
    if (this.myEnergy && this.myEnergy < 20) {
      console.log(`🔋 Energy low (${this.myEnergy}), resting to recover...`);
      await this.sendAction('rest');
      return;
    }

    // Find target enemy
    if (this.enemies.length === 0) {
      console.log(`😔 No enemies found, resting...`);
      await this.sendAction('rest');
      return;
    }

    const nearestEnemy = this.findNearestEnemy();
    if (!nearestEnemy) {
      console.log(`⏭️ No valid enemy target, resting...`);
      await this.sendAction('rest');
      return;
    }

    this.targetEnemy = nearestEnemy;
    const distance = this.getDistance(this.myPosition, nearestEnemy.position);
    
    console.log(`🎯 Target: ${nearestEnemy.code} at (${nearestEnemy.position.x}, ${nearestEnemy.position.y}), distance=${distance}, energy=${nearestEnemy.energy}`);

    // Check if we're on same position (collision!)
    if (this.myPosition.x === nearestEnemy.position.x && this.myPosition.y === nearestEnemy.position.y) {
      console.log(`💥💥💥 COLLISION WITH ${nearestEnemy.code}! RAMMING SUCCESSFUL!`);
      this.consecutiveRamAttempts = 0;
      await this.sendAction('rest'); // Rest after collision
      return;
    }

    // Check if we're adjacent (will collide next move)
    if (distance === 1) {
      console.log(`⚡ Adjacent to ${nearestEnemy.code}! Preparing to RAM!`);
      this.consecutiveRamAttempts++;
    }

    // Move towards enemy
    const direction = this.getDirectionTowards(nearestEnemy.position);
    if (direction) {
      console.log(`➡️ Moving ${direction} towards ${nearestEnemy.code} for RAMMING ATTACK!`);
      await this.sendAction('move', direction);
    } else {
      console.log(`⏭️ Cannot move towards enemy, trying alternative route...`);
      const altDirection = this.findAlternativeDirection();
      if (altDirection) {
        console.log(`🔄 Trying alternative direction: ${altDirection}`);
        await this.sendAction('move', altDirection);
      } else {
        console.log(`⏭️ No valid moves, resting...`);
        await this.sendAction('rest');
      }
    }
  }

  private findNearestEnemy(): PlayerInfo | undefined {
    if (!this.myPosition || this.enemies.length === 0) return undefined;

    let nearest: PlayerInfo | undefined;
    let minDistance = Infinity;

    for (const enemy of this.enemies) {
      if (!enemy.position) continue;
      
      const distance = this.getDistance(this.myPosition, enemy.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private getDistance(from: Position, to: Position): number {
    return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  }

  private getDirectionTowards(target: Position): string | null {
    if (!this.myPosition) return null;

    const dx = target.x - this.myPosition.x;
    const dy = target.y - this.myPosition.y;

    // Aggressive approach - prefer direction with largest delta
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? 'east' : 'west';
      if (this.isValidMove(dir)) return dir;
    } else if (Math.abs(dy) > 0) {
      const dir = dy > 0 ? 'south' : 'north';
      if (this.isValidMove(dir)) return dir;
    }

    // Try alternative direction
    if (Math.abs(dx) > 0) {
      const dir = dx > 0 ? 'east' : 'west';
      if (this.isValidMove(dir)) return dir;
    }
    if (Math.abs(dy) > 0) {
      const dir = dy > 0 ? 'south' : 'north';
      if (this.isValidMove(dir)) return dir;
    }

    return null;
  }

  private findAlternativeDirection(): string | null {
    const directions = ['north', 'south', 'east', 'west'];
    for (const dir of directions) {
      if (this.isValidMove(dir)) {
        return dir;
      }
    }
    return null;
  }

  private isValidMove(direction: string): boolean {
    if (!this.myPosition || !this.terrain) return false;

    const newPos = this.getNewPosition(direction);
    if (!newPos) return false;

    // Check bounds
    if (newPos.x < 0 || newPos.y < 0 || newPos.y >= this.terrain.length || newPos.x >= this.terrain[0].length) {
      return false;
    }

    // Check terrain (0 = walkable)
    if (this.terrain[newPos.y][newPos.x] !== 0) {
      return false;
    }

    return true;
  }

  private getNewPosition(direction: string): Position | null {
    if (!this.myPosition) return null;

    const pos = { ...this.myPosition };
    switch (direction) {
      case 'north': pos.y -= 1; break;
      case 'south': pos.y += 1; break;
      case 'east': pos.x += 1; break;
      case 'west': pos.x -= 1; break;
      default: return null;
    }
    return pos;
  }

  private async sendAction(action: string, direction?: string) {
    try {
      // Get player secret from environment
      const playerSecret = process.env.PLAYER_SECRET;
      if (!playerSecret) {
        console.error(`❌ PLAYER_SECRET not set in environment`);
        return;
      }

      let url: string;
      
      switch (action) {
        case 'move':
          if (!direction) throw new Error('Direction required for move action');
          url = `${this.apiUrl}/game/${this.gameId}/player/${this.playerId}/move`;
          await axios.post(url, { direction }, {
            headers: {
              'player-secret': playerSecret
            }
          });
          break;
        case 'trap':
          url = `${this.apiUrl}/game/${this.gameId}/player/${this.playerId}/trap`;
          await axios.post(url, {}, {
            headers: {
              'player-secret': playerSecret
            }
          });
          break;
        case 'rest':
        default:
          url = `${this.apiUrl}/game/${this.gameId}/player/${this.playerId}/rest`;
          await axios.post(url, {}, {
            headers: {
              'player-secret': playerSecret
            }
          });
          break;
      }
    } catch (error: any) {
      console.error(`❌ Error sending action:`, error.response?.data?.error || error.message);
    }
  }
}

// Main entry point
const gameId = process.argv[2] || process.env.GAME_ID || 'collision-test-game';
const playerId = process.argv[3] || process.env.PLAYER_ID || 'ramming-bot';
const apiUrl = process.env.API_URL || 'http://localhost:3000';
const actionInterval = parseInt(process.env.ACTION_INTERVAL || '1500');

const bot = new RammingBot(gameId, playerId, apiUrl, actionInterval);

bot.start();

// Graceful shutdown
process.on('SIGINT', () => {
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stop();
  process.exit(0);
});
