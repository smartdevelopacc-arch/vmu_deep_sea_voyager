/**
 * Trap Hunter Bot - Tìm và dẫm trap của đối thủ
 * 
 * Hành vi:
 * - Scan toàn bộ bản đồ để tìm trap
 * - Di chuyển tới vị trí trap gần nhất
 * - Cố gắng dẫm trap để test xử lý trap
 * - Tránh base và obstacle
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

interface Position {
  x: number;
  y: number;
}

interface TrapInfo {
  position: Position;
  playerId: string;
  danger: number;
}

class TrapHunterBot {
  private gameId: string;
  private playerId: string;
  private apiUrl: string;
  private actionInterval: number;
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;

  private myPosition?: Position;
  private basePosition?: Position;
  private terrain?: number[][];
  private traps: TrapInfo[] = [];
  private targetTrap?: TrapInfo;

  constructor(gameId: string, playerId: string, apiUrl: string, actionInterval: number = 2000) {
    this.gameId = gameId;
    this.playerId = playerId;
    this.apiUrl = apiUrl;
    this.actionInterval = actionInterval;
  }

  async start() {
    console.log(`🎯 Trap Hunter Bot starting for player ${this.playerId}`);
    this.running = true;

    await this.fetchGameConfig();
    await this.fetchGameState();

    this.intervalId = setInterval(() => {
      this.executeAction();
    }, this.actionInterval);

    console.log(`✅ Trap Hunter Bot started - Looking for traps to step on!`);
  }

  stop() {
    console.log(`🛑 Trap Hunter Bot stopping...`);
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log(`✅ Trap Hunter Bot stopped`);
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
      }

      // Get traps from state
      const trapsData = response.data.traps || [];
      this.traps = [];
      
      if (Array.isArray(trapsData)) {
        this.traps = trapsData.map((trap: any) => ({
          position: trap.position || { x: trap[0], y: trap[1] },
          playerId: trap.playerId || trap[3],
          danger: trap.danger || trap[2] || 1
        }));
      } else {
        // Object format
        Object.values(trapsData).forEach((trap: any) => {
          this.traps.push({
            position: trap.position,
            playerId: trap.playerId,
            danger: trap.danger || 1
          });
        });
      }

      // Filter out my own traps
      this.traps = this.traps.filter(trap => trap.playerId !== this.playerId);

      if (this.traps.length > 0) {
        console.log(`🪤 Found ${this.traps.length} enemy traps!`);
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

    // Find nearest trap
    if (this.traps.length === 0) {
      console.log(`😔 No enemy traps found, resting...`);
      await this.sendAction('rest');
      return;
    }

    const nearestTrap = this.findNearestTrap();
    if (!nearestTrap) {
      console.log(`⏭️ No valid trap target, resting...`);
      await this.sendAction('rest');
      return;
    }

    this.targetTrap = nearestTrap;
    const distance = this.getDistance(this.myPosition, nearestTrap.position);
    
    console.log(`🎯 Target trap at (${nearestTrap.position.x}, ${nearestTrap.position.y}), distance=${distance}, danger=${nearestTrap.danger}`);

    // Check if we're on the trap
    if (this.myPosition.x === nearestTrap.position.x && this.myPosition.y === nearestTrap.position.y) {
      console.log(`💥 STEPPED ON TRAP! Taking ${nearestTrap.danger} damage!`);
      await this.sendAction('rest');
      return;
    }

    // Move towards trap
    const direction = this.getDirectionTowards(nearestTrap.position);
    if (direction) {
      console.log(`➡️ Moving ${direction} towards trap`);
      await this.sendAction('move', direction);
    } else {
      console.log(`⏭️ Cannot move towards trap, resting...`);
      await this.sendAction('rest');
    }
  }

  private findNearestTrap(): TrapInfo | undefined {
    if (!this.myPosition || this.traps.length === 0) return undefined;

    let nearest: TrapInfo | undefined;
    let minDistance = Infinity;

    for (const trap of this.traps) {
      const distance = this.getDistance(this.myPosition, trap.position);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = trap;
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

    // Prefer horizontal movement first
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? 'east' : 'west';
      if (this.isValidMove(dir)) return dir;
    } else {
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
const gameId = process.argv[2] || process.env.GAME_ID || 'trap-test-game';
const playerId = process.argv[3] || process.env.PLAYER_ID || 'trap-hunter';
const apiUrl = process.env.API_URL || 'http://localhost:3000';
const actionInterval = parseInt(process.env.ACTION_INTERVAL || '2000');

const bot = new TrapHunterBot(gameId, playerId, apiUrl, actionInterval);

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
