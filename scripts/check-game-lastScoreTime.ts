import * as dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../src/core/db';
import { GameModel } from '../src/models/game.model';

/**
 * Check game data for lastScoreTime field
 */
async function checkGameLastScoreTime() {
  console.log('🔍 Checking game data for lastScoreTime...\n');

  await connectDB();

  const gameCode = process.argv[2] || 't2';
  
  try {
    const game = await GameModel.findOne({ code: gameCode });
    
    if (!game) {
      console.log(`❌ Game ${gameCode} not found`);
      process.exit(1);
    }

    console.log(`📊 Game: ${game.code} (${game.name})`);
    console.log(`📊 Status: ${game.status}`);
    console.log(`📊 StartedAt: ${game.startedAt || 'NOT SET'}`);
    if (game.startedAt) {
      console.log(`📊 StartedAt Formatted: ${new Date(game.startedAt).toLocaleString('vi-VN')}`);
    }
    console.log(`📊 StartTime: ${game.startTime || 'NOT SET'}`);
    if (game.startTime) {
      console.log(`📊 StartTime Formatted: ${new Date(game.startTime).toLocaleString('vi-VN')}`);
    }
    console.log(`📊 Players: ${game.players.length}\n`);

    game.players.forEach((player: any, idx: number) => {
      console.log(`${idx + 1}. ${player.name || player.code}`);
      console.log(`   Score: ${player.score}`);
      console.log(`   CarriedTreasure: ${player.carriedTreasure || 0}`);
      console.log(`   LastScoreTime: ${player.lastScoreTime || 'NOT SET'}`);
      if (player.lastScoreTime) {
        console.log(`   Formatted: ${new Date(player.lastScoreTime).toLocaleString('vi-VN')}`);
      }
      console.log('');
    });

    console.log('\n✅ Check completed');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkGameLastScoreTime().catch(console.error);
