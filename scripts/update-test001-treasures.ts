/**
 * Script để update treasures cho game test001
 * Thêm treasures ngẫu nhiên vào map config
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { GameModel } from '../src/models/game.model';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deep_sea_voyager';

/**
 * Generate treasures ngẫu nhiên: giá trị cao hơn ở gần tâm
 * Số lượng = 20% * N (với map NxN)
 */
function generateRandomTreasures(width: number, height: number): number[][] {
  const treasures: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  
  // Số lượng kho báu = 30% * N (tăng lên để có nhiều treasure hơn)
  const N = Math.min(width, height);
  const treasureCount = Math.floor(N * 0.3); // 30% thay vì 20%
  
  console.log(`Generating ${treasureCount} treasures for ${width}x${height} map`);
  
  // Bán kính tâm map để đặt treasure
  const treasureRadius = maxDistance * 0.4;
  
  let placed = 0;
  const maxAttempts = treasureCount * 100;
  let attempts = 0;
  
  while (placed < treasureCount && attempts < maxAttempts) {
    attempts++;
    
    // Random vị trí trong vùng tâm
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * treasureRadius;
    
    const x = Math.floor(centerX + distance * Math.cos(angle));
    const y = Math.floor(centerY + distance * Math.sin(angle));
    
    // Kiểm tra vị trí hợp lệ
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (treasures[y][x] > 0) continue;
    
    // Tính khoảng cách từ tâm để xác định giá trị
    const distX = x - centerX;
    const distY = y - centerY;
    const actualDistance = Math.sqrt(distX * distX + distY * distY);
    
    // Normalize: 0 (xa) -> 1 (gần tâm)
    const normalized = 1 - (actualDistance / maxDistance);
    
    // Giá trị treasure: 10, 30, 50, 80, 100 dựa theo khoảng cách
    let value: number;
    if (normalized > 0.8) value = 100;
    else if (normalized > 0.6) value = 80;
    else if (normalized > 0.4) value = 50;
    else if (normalized > 0.2) value = 30;
    else value = 10;
    
    treasures[y][x] = value;
    placed++;
    console.log(`  [${placed}/${treasureCount}] Treasure ${value} at (${x}, ${y})`);
  }
  
  console.log(`✅ Placed ${placed} treasures`);
  return treasures;
}

async function updateTest001Treasures() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find test001 game
    const game = await GameModel.findOne({ code: 'test001' });
    if (!game) {
      console.error('❌ Game test001 not found');
      process.exit(1);
    }
    
    console.log(`Found game: ${game.name} (${game.code})`);
    console.log(`Map size: ${game.map.width}x${game.map.height}`);
    
    // Generate new treasures
    const newTreasures = generateRandomTreasures(game.map.width, game.map.height);
    
    // Update map config
    game.map.treasures = newTreasures as any;
    game.markModified('map.treasures');
    
    // Clear runtime state để force reload từ map config
    game.runtimeState = undefined;
    game.markModified('runtimeState');
    
    await game.save();
    
    console.log('✅ Updated game test001 with new treasures');
    console.log(`Total treasures: ${newTreasures.flat().filter(t => t > 0).length}`);
    
    // Verify
    const updated = await GameModel.findOne({ code: 'test001' });
    const count = updated?.map.treasures.flat().filter((t: number) => t > 0).length;
    console.log(`Verified: ${count} treasures in database`);
    
    await mongoose.disconnect();
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateTest001Treasures();
