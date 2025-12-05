import * as mongoose from 'mongoose';
import * as path from 'path';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Import GameModel
import { GameModel } from '../models/game.model';

async function checkGame10Traps() {
  const mongoUri = process.env.MONGO_URI;
  
  if (!mongoUri) {
    console.log('MONGO_URI not found in environment');
    return;
  }
  
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoUri);
  } catch (err: any) {
    console.log('Connection error:', err.message);
    return;
  }
  
  const game = await GameModel.findOne({ code: '10' });
  
  if (!game) {
    console.log('Game 10 not found');
    await mongoose.connection.close();
    return;
  }
  
  console.log('\n=== GAME 10 ===');
  console.log('Status:', game.status);
  console.log('Turn:', game.currentTurn);
  
  let trapsCollection: any = null;
  
  // Check if traps are in runtimeState or map
  if (game.runtimeState?.traps) {
    console.log('Traps found in runtimeState');
    trapsCollection = game.runtimeState.traps;
  } else if (game.map?.traps) {
    console.log('Traps found in map');
    trapsCollection = game.map.traps;
  } else {
    console.log('No traps found');
    await mongoose.connection.close();
    return;
  }
  
  console.log('\nTotal traps in game:', Object.keys(trapsCollection).length);
  
  // Group traps by player
  const trapsByPlayer: { [playerId: string]: any[] } = {};
  
  Object.entries(trapsCollection).forEach(([key, trap]: [string, any]) => {
    const playerId = trap.playerId;
    if (!trapsByPlayer[playerId]) {
      trapsByPlayer[playerId] = [];
    }
    trapsByPlayer[playerId].push({
      key,
      pos: trap.position,
      danger: trap.danger,
      createdAt: trap.createdAt ? new Date(trap.createdAt).toISOString() : 'N/A'
    });
  });
  
  // Display traps per player
  for (const [playerId, traps] of Object.entries(trapsByPlayer)) {
    const player = game.players.find((p: any) => p.playerId === playerId);
    const playerName = player ? player.code : 'Unknown';
    const status = traps.length > 5 ? '⚠️ EXCEEDS LIMIT' : '✅';
    console.log(`\n${status} ${playerName} (${playerId}): ${traps.length} traps (MAX: 5)`);
    
    // Sort by createdAt to show oldest first
    traps.sort((a, b) => {
      if (a.createdAt === 'N/A') return 1;
      if (b.createdAt === 'N/A') return -1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    traps.forEach((t, i) => {
      console.log(`   ${i+1}. [${t.pos.x},${t.pos.y}] danger=${t.danger} created=${t.createdAt}`);
    });
  }
  
  await mongoose.connection.close();
}

checkGame10Traps().catch(console.error);
