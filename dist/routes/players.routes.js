"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const playerImporter_1 = require("../core/playerImporter");
const player_model_1 = require("../models/player.model");
const crypto_1 = __importDefault(require("crypto"));
const adminAuthMiddleware_1 = require("../core/adminAuthMiddleware");
const router = (0, express_1.Router)();
/**
 * Generate a 5-character random secret
 */
const generateShortSecret = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const randomBytes = crypto_1.default.randomBytes(5);
    for (let i = 0; i < 5; i++) {
        result += chars[randomBytes[i] % chars.length];
    }
    return result;
};
/**
 * GET /api/players - Lấy danh sách players có sẵn trong hệ thống
 */
router.get('/', async (req, res) => {
    try {
        const players = await (0, playerImporter_1.getAvailablePlayers)();
        res.json({ players });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * POST /api/players/:playerCode/regenerate-secret - Random secret mới cho player
 * Requires admin API key
 */
router.post('/:playerCode/regenerate-secret', adminAuthMiddleware_1.validateAdminApiKey, async (req, res) => {
    try {
        const { playerCode } = req.params;
        const player = await player_model_1.Player.findOne({ code: playerCode });
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        // Generate new 5-character secret
        const newSecret = generateShortSecret();
        player.secret = newSecret;
        await player.save();
        res.json({
            success: true,
            playerCode,
            secret: newSecret
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
