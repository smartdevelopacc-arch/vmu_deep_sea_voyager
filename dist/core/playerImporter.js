"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePlayerCodes = exports.getAvailablePlayers = exports.importPlayers = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const player_model_1 = require("../models/player.model");
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
            // Upsert player vào database
            await player_model_1.Player.findOneAndUpdate({ code: playerCode }, {
                code: playerCode,
                name: info.name,
                slogan: info.slogan,
                logo: info.logo || '', // Logo đã là base64 string trong JSON
                score: 0,
                energy: 100
            }, { upsert: true, new: true });
            console.log(`✅ Imported player: ${playerCode} - ${info.name}`);
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
    const players = await player_model_1.Player.find({}).select('code name logo slogan');
    return players.map(p => ({
        code: p.code,
        name: p.name,
        logo: p.logo,
        slogan: p.slogan
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
