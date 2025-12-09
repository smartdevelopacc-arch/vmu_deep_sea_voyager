import fs from 'fs';
import path from 'path';
import { Player } from '../models/player.model';
import { connectDB } from './db';
import crypto from 'crypto';

interface PlayerInfo {
  name: string;
  slogan: string;
  logo: string;
  player_secret?: string; // Optional: if provided in JSON, use it instead of generating
}

/**
 * Generate a secure random secret for player authentication
 * 5 characters: uppercase letters and numbers
 */
const generatePlayerSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

/**
 * Import players từ thư mục assets/players/ vào MongoDB
 * Mỗi player là một file: assets/players/<player_code>.json
 */
export const importPlayers = async () => {
  const playersDir = path.join(__dirname, '../../assets/players');
  
  if (!fs.existsSync(playersDir)) {
    console.log('⚠️  Players directory not found. Creating example structure...');
    return;
  }

  const files = fs.readdirSync(playersDir).filter(file => {
    return file.endsWith('.json') && fs.statSync(path.join(playersDir, file)).isFile();
  });

  console.log(`📦 Found ${files.length} player files`);

  for (const file of files) {
    const playerCode = path.basename(file, '.json');
    const filePath = path.join(playersDir, file);

    try {
      const info: PlayerInfo = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // ✅ Check if player already exists
      const existingPlayer = await Player.findOne({ code: playerCode });
      
      // Prepare update data
      const updateData: any = {
        code: playerCode,
        name: info.name,
        slogan: info.slogan,
        logo: info.logo || '', // Logo đã là base64 string trong JSON
        score: 0,
        energy: 100
      };
      
      // Handle secret key logic:
      // Support both 'player_secret' and 'secret' field names in JSON
      // 1. If player_secret/secret in JSON → ALWAYS use it (overwrite existing or set new)
      // 2. If no player_secret/secret in JSON and player exists → keep existing secret (don't overwrite)
      // 3. If no player_secret/secret in JSON and new player → generate new secret
      const jsonSecret = (info as any).player_secret || (info as any).secret;
      if (jsonSecret) {
        // Case 1: JSON has secret → ALWAYS use it (overwrite)
        updateData.secret = jsonSecret;
      } else if (!existingPlayer) {
        // Case 3: New player, no secret in JSON → generate new
        updateData.secret = generatePlayerSecret();
      }
      // Case 2: Existing player, no secret in JSON → don't set secret field (MongoDB will keep existing value)

      // Upsert player vào database
      const savedPlayer = await Player.findOneAndUpdate(
        { code: playerCode },
        updateData,
        { upsert: true, new: true }
      );

      const displaySecret = savedPlayer.secret || 'N/A';
      console.log(`✅ Imported player: ${playerCode} - ${info.name} (Secret: ${displaySecret})`);
    } catch (error: any) {
      console.error(`❌ Failed to import ${playerCode}:`, error.message);
    }
  }

  console.log('🎮 Player import completed');
};

/**
 * Get danh sách players từ DB
 */
export const getAvailablePlayers = async () => {
  const players = await Player.find({}).select('code name logo slogan secret');
  return players.map(p => ({
    code: p.code,
    name: p.name,
    logo: p.logo,
    slogan: p.slogan,
    secret: p.secret || '' // ✅ Include secret for display
  }));
};

/**
 * Validate player codes có tồn tại trong DB không
 */
export const validatePlayerCodes = async (playerCodes: string[]): Promise<boolean> => {
  const existingPlayers = await Player.find({ 
    code: { $in: playerCodes } 
  }).select('code');
  
  const existingCodes = existingPlayers.map(p => p.code);
  const missingCodes = playerCodes.filter(code => !existingCodes.includes(code));
  
  if (missingCodes.length > 0) {
    console.log(`⚠️  Missing players: ${missingCodes.join(', ')}`);
    return false;
  }
  
  return true;
};
