/**
 * Multi Bot Runner - Test game với toàn bộ player cùng lúc
 * 
 * Chạy bots cho tất cả players trong game một lúc
 * Tuỳ chọn action interval cho mỗi bot
 * Lấy player secrets từ testbot/.env theo format: PLAYER_CODE=secret
 * 
 * Usage:
 *   npx ts-node src/scripts/multi-bot-runner.ts --gameId game001 --interval 1500 --duration 60000
 * 
 * Options:
 *   --gameId: ID của game cần test (bắt buộc)
 *   --interval: Action interval per bot in ms (default: 1500)
 *   --duration: Tổng thời gian chạy bot in ms (default: 0 = vô hạn)
 *   --apiUrl: API server URL (default: http://localhost:3000/api)
 *   --verbose: Enable verbose logging (default: false)
 * 
 * Example .env file (testbot/.env):
 *   team_alpha=secret_alpha
 *   team_beta=secret_beta
 *   team_gamma=secret_gamma
 *   team_delta=secret_delta
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import { spawn } from 'child_process';
import * as path from 'path';

dotenv.config();

interface MultiRunnerConfig {
  gameId: string;
  actionInterval: number;
  duration: number;
  apiUrl: string;
  verbose: boolean;
}

interface PlayerBot {
  playerId: string;
  code: string;
  process?: any;
  secret?: string;
}

class MultiBotRunner {
  private config: MultiRunnerConfig;
  private bots: Map<string, PlayerBot> = new Map();
  private running: boolean = false;
  private timeoutId?: NodeJS.Timeout;
  private startTime: number = 0;
  private playerSecrets: Record<string, string> = {};

  constructor(config: MultiRunnerConfig) {
    this.config = config;
    this.playerSecrets = this.loadPlayerSecrets();
  }

  /**
   * Load player secrets from process.env (.env file)
   * Searches for keys matching player codes (case-insensitive)
   */
  private loadPlayerSecrets(): Record<string, string> {
    const secrets: Record<string, string> = {};

    // Allow both lowercase player codes and PLAYER_SECRET_<CODE> patterns
    const ignored = new Set([
      'node_env', 'api_url', 'game_id', 'player_id', 'player_secret',
      'action_interval', 'multi_action_interval', 'multi_duration'
    ]);

    for (const [rawKey, value] of Object.entries(process.env)) {
      if (typeof value !== 'string' || value.length === 0 || rawKey.startsWith('npm_')) continue;

      const key = rawKey.trim();
      const keyLower = key.toLowerCase();

      // Skip known non-secret keys
      if (ignored.has(keyLower)) continue;

      // Pattern 1: plain player code in any case (store lowercase)
      if (key === key.toLowerCase()) {
        secrets[keyLower] = value;
        continue;
      }

      // Pattern 2: PLAYER_SECRET_<CODE> (any case) => map to <code>
      if (key.startsWith('PLAYER_SECRET_')) {
        const code = key.replace(/^PLAYER_SECRET_/i, '').toLowerCase();
        if (code) {
          secrets[code] = value;
        }
      }
    }

    return secrets;
  }

  /**
   * Start multi-bot runner
   * - Fetch all players from game
   * - Create and start bot for each player
   * - Monitor game state
   */
  async start() {
    console.log('\n🤖 Multi Bot Runner Starting');
    console.log('━'.repeat(50));
    console.log(`🎮 Game ID: ${this.config.gameId}`);
    console.log(`⏱️  Action Interval: ${this.config.actionInterval}ms per bot`);
    console.log(`⏰ Duration: ${this.config.duration === 0 ? 'Infinite' : this.config.duration + 'ms'}`);
    console.log(`🌐 API URL: ${this.config.apiUrl}`);
    console.log('━'.repeat(50));

    try {
      // Verify game exists
      const gameStatus = await this.getGameStatus();
      if (!gameStatus) {
        console.error('❌ Game not found or not accessible');
        return;
      }

      console.log(`\n📊 Game Status: ${gameStatus.status}`);
      console.log(`👥 Players: ${gameStatus.players?.length || 0}`);

      // Get all players
      const players = await this.getAllPlayers();
      if (!players || players.length === 0) {
        console.error('❌ No players found in game');
        return;
      }

      console.log(`✅ Found ${players.length} players to control\n`);

      // Log loaded secrets
      if (Object.keys(this.playerSecrets).length > 0) {
        console.log(`🔑 Loaded player secrets from .env:`);
        Object.keys(this.playerSecrets).forEach(key => {
          console.log(`   ${key}: ***`);
        });
        console.log('');
      }

      // Create and start bot for each player
      for (const player of players) {
        const playerId = player.playerId || player.code;
        const playerCode = player.code?.toLowerCase() || '';
        const playerIdLower = playerId.toLowerCase();
        
        // Try to find secret by player code or player ID
        const playerSecret = this.playerSecrets[playerCode] || this.playerSecrets[playerIdLower] || '';
        
        if (playerSecret) {
          console.log(`🚀 Launching bot for ${player.name} (${playerId}) [🔑 secret: ${playerCode || playerIdLower}]`);
        } else {
          console.log(`🚀 Launching bot for ${player.name} (${playerId}) [⚠️  no secret in .env]`);
        }
        
        // Spawn TestBot with environment variables
        const botEnv = {
          ...process.env,
          PLAYER_ID: playerId,
          PLAYER_SECRET: playerSecret,
          ACTION_INTERVAL: String(this.config.actionInterval),
          GAME_ID: this.config.gameId,
          API_URL: this.config.apiUrl
        };

        const botProcess = spawn('npx', ['ts-node', path.join(__dirname, '../index.ts')], {
          env: botEnv,
          stdio: 'inherit'
        });

        this.bots.set(playerId, {
          playerId,
          code: player.code,
          process: botProcess,
          secret: playerSecret ? '***' : 'none'
        });
      }

      this.running = true;
      this.startTime = Date.now();

      console.log(`\n✅ All ${this.bots.size} bots started successfully!\n`);

      // Start monitoring
      this.monitor();

      // Set duration timeout if specified
      if (this.config.duration > 0) {
        this.timeoutId = setTimeout(() => {
          console.log('\n⏰ Duration reached, stopping all bots...');
          this.stop();
        }, this.config.duration);
      }

    } catch (error: any) {
      console.error('❌ Error starting multi-bot runner:', error.message);
      this.stop();
    }
  }

  /**
   * Monitor game state and bots periodically
   */
  private monitor() {
    const monitorIntervalId = setInterval(async () => {
      if (!this.running) {
        clearInterval(monitorIntervalId);
        return;
      }

      try {
        const gameStatus = await this.getGameStatus();
        
        if (gameStatus) {
          const elapsed = Date.now() - this.startTime;
          const elapsedSec = (elapsed / 1000).toFixed(1);
          
          if (this.config.verbose) {
            console.log(`\n📊 [${elapsedSec}s] Game Status: ${gameStatus.status}`);
            console.log('Leaderboard:');
            gameStatus.players?.forEach((p: any, idx: number) => {
              const botStatus = this.bots.get(p.playerId || p.code);
              console.log(
                `  ${idx + 1}. ${p.name} - Score: ${p.score}, Energy: ${p.energy} ${botStatus ? '🤖' : ''}`
              );
            });
          } else {
            console.log(`[${elapsedSec}s] 🎮 ${gameStatus.status}`);
          }

          // Stop if game is finished
          if (gameStatus.status === 'finished') {
            console.log('\n🏁 Game finished! Stopping all bots...');
            this.stop();
          }
        }
      } catch (error: any) {
        if (this.config.verbose) {
          console.error('❌ Monitor error:', error.message);
        }
      }
    }, 5000); // Monitor every 5 seconds
  }

  /**
   * Stop all bots
   */
  stop() {
    if (!this.running) return;

    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    console.log('\n🛑 Stopping all bots...');
    
    let stoppedCount = 0;
    this.bots.forEach(({ playerId, process: botProcess }) => {
      try {
        if (botProcess) {
          botProcess.kill();
        }
        stoppedCount++;
      } catch (error: any) {
        console.error(`❌ Error stopping bot for ${playerId}:`, error.message);
      }
    });

    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`✅ All ${stoppedCount} bots stopped after ${totalTime}s`);
    console.log('━'.repeat(50));
  }

  /**
   * Get game status
   */
  private async getGameStatus(): Promise<any> {
    try {
      const response = await axios.get(`${this.config.apiUrl}/game/${this.config.gameId}/status`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all players in game
   */
  private async getAllPlayers(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.config.apiUrl}/game/${this.config.gameId}/state`);
      return response.data.players || [];
    } catch (error: any) {
      console.error('❌ Error fetching players:', error.message);
      return [];
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): MultiRunnerConfig {
  const args = process.argv.slice(2);
  const positional: string[] = [];

  const showHelp = () => {
    console.log(`
Multi Bot Runner - Test game với toàn bộ player

Usage:
  npx ts-node src/scripts/multi-bot-runner.ts <gameId?> [intervalMs] [durationMs] [apiUrl] [--verbose]
  npm run multi-bot -- <gameId?> [intervalMs] [durationMs] [apiUrl] [--verbose]

Priority: CLI args override .env.
Env defaults:
  GAME_ID, MULTI_ACTION_INTERVAL (or ACTION_INTERVAL), MULTI_DURATION, API_URL

Options:
  --gameId GAME_ID       ID của game cần test (bắt buộc nếu thiếu GAME_ID)
  --interval MS          Action interval per bot in ms (default: 1500)
  --duration MS          Tổng thời gian chạy in ms (default: 0 = vô hạn)
  --apiUrl URL           API server URL (default: http://localhost:3000/api)
  --verbose              Enable verbose logging
  --help                 Show this help message

Setup .env file (testbot/.env):
  Thêm player secrets với format: player_code=secret_value
  Ví dụ:
    team_alpha=secret_alpha_key
    team_beta=secret_beta_key

Examples:
  npx ts-node src/scripts/multi-bot-runner.ts t1
  npx ts-node src/scripts/multi-bot-runner.ts t1 1200 60000 http://localhost:3000/api --verbose
  npm run multi-bot -- t1 1500
    `);
  };

  const config: any = {
    gameId: process.env.GAME_ID || '',
    actionInterval: process.env.MULTI_ACTION_INTERVAL
      ? parseInt(process.env.MULTI_ACTION_INTERVAL, 10)
      : (process.env.ACTION_INTERVAL ? parseInt(process.env.ACTION_INTERVAL, 10) : 1500),
    duration: process.env.MULTI_DURATION ? parseInt(process.env.MULTI_DURATION, 10) : 0,
    apiUrl: process.env.API_URL || 'http://localhost:3000/api',
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    if (arg === '--gameId' && value) {
      config.gameId = value;
      i++;
    } else if (arg === '--interval' && value) {
      config.actionInterval = parseInt(value, 10);
      i++;
    } else if (arg === '--duration' && value) {
      config.duration = parseInt(value, 10);
      i++;
    } else if (arg === '--apiUrl' && value) {
      config.apiUrl = value;
      i++;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  // Apply positional overrides: <gameId> [interval] [duration] [apiUrl]
  if (positional[0]) config.gameId = positional[0];
  if (positional[1]) config.actionInterval = parseInt(positional[1], 10);
  if (positional[2]) config.duration = parseInt(positional[2], 10);
  if (positional[3]) config.apiUrl = positional[3];

  // Validate numbers with fallbacks
  if (!Number.isFinite(config.actionInterval)) {
    const fallback = process.env.MULTI_ACTION_INTERVAL
      ? parseInt(process.env.MULTI_ACTION_INTERVAL, 10)
      : (process.env.ACTION_INTERVAL ? parseInt(process.env.ACTION_INTERVAL, 10) : 1500);
    console.warn(`⚠️  Invalid interval provided, falling back to ${fallback}ms`);
    config.actionInterval = fallback;
  }
  if (!Number.isFinite(config.duration)) {
    console.warn('⚠️  Invalid duration provided, falling back to 0 (infinite)');
    config.duration = 0;
  }

  if (!config.gameId) {
    console.error('❌ Error: gameId is required (arg or env GAME_ID)');
    showHelp();
    process.exit(1);
  }

  return config;
}

/**
 * Main entry point
 */
async function main() {
  const config = parseArgs();
  const runner = new MultiBotRunner(config);

  // Handle graceful shutdown
  const handleShutdown = () => {
    console.log('\n⏹️  Received shutdown signal...');
    runner.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  // Start the runner
  await runner.start();
}

main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});
