"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlayerCodes = exports.getAvailablePlayers = exports.importPlayers = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const player_model_1 = require("../models/player.model");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a secure random secret for player authentication
 * 5 characters: uppercase letters and numbers
 */
const generatePlayerSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const randomBytes = crypto_1.default.randomBytes(5);
    for (let i = 0; i < 5; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
};
/**
 * Import players từ thư mục assets/players/ vào MongoDB
 * Mỗi player là một file: assets/players/<player_code>.json
 */
const importPlayers = async () => {
    const playersDir = path_1.default.join(__dirname, '../../assets/players');
    if (!fs_1.default.existsSync(playersDir)) {
        console.log('⚠️  Players directory not found. Creating example structure...');
        return;
    }
    const files = fs_1.default.readdirSync(playersDir).filter(file => {
        return file.endsWith('.json') && fs_1.default.statSync(path_1.default.join(playersDir, file)).isFile();
    });
    console.log(`📦 Found ${files.length} player files`);
    for (const file of files) {
        const playerCode = path_1.default.basename(file, '.json');
        const filePath = path_1.default.join(playersDir, file);
        try {
            const info = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
            // ✅ NEW: Use player_secret from file if provided, otherwise generate or retrieve existing
            const existingPlayer = await player_model_1.Player.findOne({ code: playerCode });
            let secret;
            if (info.player_secret) {
                // Use secret from JSON file
                secret = info.player_secret;
            }
            else if (existingPlayer?.secret) {
                // Keep existing secret from database
                secret = existingPlayer.secret;
            }
            else {
                // Generate new random secret
                secret = generatePlayerSecret();
            }
            // Upsert player vào database
            await player_model_1.Player.findOneAndUpdate({ code: playerCode }, {
                code: playerCode,
                name: info.name,
                slogan: info.slogan,
                logo: info.logo || '', // Logo đã là base64 string trong JSON
                secret: secret, // ✅ NEW: Store player secret
                score: 0,
                energy: 100
            }, { upsert: true, new: true });
            console.log(`✅ Imported player: ${playerCode} - ${info.name} (Secret: ${secret})`);
        }
        catch (error) {
            console.error(`❌ Failed to import ${playerCode}:`, error.message);
        }
    }
    console.log('🎮 Player import completed');
};
exports.importPlayers = importPlayers;
/**
 * Get danh sách players từ DB
 */
const getAvailablePlayers = async () => {
    const players = await player_model_1.Player.find({}).select('code name logo slogan secret');
    return players.map(p => ({
        code: p.code,
        name: p.name,
        logo: p.logo,
        slogan: p.slogan,
        secret: p.secret || '' // ✅ Include secret for display
    }));
};
exports.getAvailablePlayers = getAvailablePlayers;
/**
 * Validate player codes có tồn tại trong DB không
 */
const validatePlayerCodes = async (playerCodes) => {
    const existingPlayers = await player_model_1.Player.find({
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
exports.validatePlayerCodes = validatePlayerCodes;
