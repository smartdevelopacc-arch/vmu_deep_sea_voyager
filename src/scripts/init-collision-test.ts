#!/usr/bin/env ts-node
/**
 * Initialize Collision & Trap Test Map (Game "collision-trap-test")
 * 
 * This game is designed to test:
 * - Player collision mechanics
 * - Trap placement and damage
 * - Energy consumption in wave zones
 * - Treasure collection strategies
 * 
 * Map features:
 * - 20x20 size (easy to visualize)
 * - Two bases close together at (2,9) and (17,9)
 * - Open central area for collision opportunities
 * - Wave zones for energy variation
 * - Multiple treasures for strategic gameplay
 * 
 * Usage:
 *   npx ts-node src/scripts/init-collision-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import { connectDB } from '../core/db';
import { GameModel } from '../models/game.model';
import { initializeGame } from '../core/gameLoop';

async function initializeCollisionTestMap() {
  try {
    await connectDB();
    
    // Load test map
    const testMapPath = path.join(__dirname, '../../test-maps/collision-trap-test.json');
    if (!fs.existsSync(testMapPath)) {
      console.error(`❌ Test map file not found: ${testMapPath}`);
      process.exit(1);
    }

    const testMapData = JSON.parse(fs.readFileSync(testMapPath, 'utf-8'));
    console.log(`📋 Loaded test map: ${testMapData.name}`);
    console.log(`   Description: ${testMapData.description}`);

    // Check if game already exists
    const existingGame = await GameModel.findOne({ code: testMapData.gameId });
    if (existingGame) {
      console.log(`⚠️  Game "${testMapData.gameId}" already exists in database`);
      console.log(`   Status: ${existingGame.status}`);
      console.log(`   Would you like to reset it? (Manual: npm run cli -- reset-db ${testMapData.gameId})`);
      process.exit(0);
    }

    // Initialize game
    console.log(`\n🎮 Initializing game "${testMapData.gameId}"...`);
    const gameState = await initializeGame(
      testMapData.gameId,
      testMapData.mapData,
      testMapData.players
    );

    console.log(`\n✅ Game initialized successfully!`);
    console.log(`\n📊 Game Details:`);
    console.log(`   ID: ${testMapData.gameId}`);
    console.log(`   Map: ${testMapData.mapData.width}x${testMapData.mapData.height}`);
    console.log(`   Players: ${testMapData.players.length}`);
    testMapData.players.forEach((p: any) => {
      console.log(`     - ${p.name} (${p.code})`);
    });

    console.log(`\n🏠 Bases:`);
    testMapData.mapData.bases.forEach((b: any, i: number) => {
      console.log(`   Base ${i + 1}: (${b[0]}, ${b[1]})`);
    });

    console.log(`\n💎 Treasures: ${testMapData.mapData.treasures.flat().filter((v: number) => v > 0).length} locations`);
    console.log(`\n🧭 Start the game with:`);
    console.log(`   curl -X POST http://localhost:3000/worker/game/${testMapData.gameId}/start`);
    console.log(`\n🤖 Run test bot with:`);
    console.log(`   npm run start -- --gameId ${testMapData.gameId} --playerId team_alpha`);

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initializeCollisionTestMap();
