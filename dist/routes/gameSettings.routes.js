"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const game_model_1 = require("../models/game.model");
const router = express_1.default.Router();
/**
 * GET /api/game/:gameId/settings
 * Lấy cấu hình game hiện tại
 */
router.get('/:gameId/settings', async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({
            settings: game.settings || {
                enableTraps: true,
                maxEnergy: 100,
                energyRestore: 10,
                maxTurns: 1200,
                timeLimitMs: 300000,
                tickIntervalMs: 500
            }
        });
    }
    catch (error) {
        console.error('Error fetching game settings:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/game/:gameId/settings
 * Cập nhật cấu hình game (chỉ khi game chưa bắt đầu hoặc đang chờ)
 */
router.put('/:gameId/settings', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { enableTraps, maxEnergy, energyRestore, maxTurns, timeLimitMs, tickIntervalMs } = req.body;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Chỉ cho phép update khi game chưa bắt đầu
        if (game.status === 'playing') {
            return res.status(400).json({ error: 'Cannot update settings while game is running' });
        }
        // Validate tickIntervalMs if provided
        if (tickIntervalMs !== undefined && tickIntervalMs < 500) {
            return res.status(400).json({ error: 'Tick interval must be at least 500ms' });
        }
        // Update settings
        game.settings = {
            enableTraps: enableTraps ?? game.settings?.enableTraps ?? true,
            maxEnergy: maxEnergy ?? game.settings?.maxEnergy ?? 100,
            energyRestore: energyRestore ?? game.settings?.energyRestore ?? 10,
            maxTurns: maxTurns ?? game.settings?.maxTurns ?? 1200,
            timeLimitMs: timeLimitMs ?? game.settings?.timeLimitMs ?? 300000,
            tickIntervalMs: tickIntervalMs ?? game.settings?.tickIntervalMs ?? 500
        };
        await game.save();
        res.json({
            success: true,
            settings: game.settings
        });
    }
    catch (error) {
        console.error('Error updating game settings:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * PUT /api/game/:gameId/map
 * Cập nhật bản đồ game (chỉ khi game chưa bắt đầu)
 */
router.put('/:gameId/map', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { terrain, waves, treasures, bases, traps } = req.body;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Chỉ cho phép update khi game chưa bắt đầu
        if (game.status === 'playing') {
            return res.status(400).json({ error: 'Cannot update map while game is running' });
        }
        // Update map data
        if (terrain)
            game.map.terrain = terrain;
        if (waves)
            game.map.waves = waves;
        if (treasures)
            game.map.treasures = treasures;
        if (bases)
            game.map.bases = bases;
        // Update runtime state traps if provided (for pre-placed traps)
        if (traps !== undefined) {
            if (!game.runtimeState) {
                game.runtimeState = {
                    treasures: game.map.treasures || [],
                    owners: [],
                    traps: []
                };
            }
            game.runtimeState.traps = traps;
        }
        await game.save();
        res.json({
            success: true,
            map: {
                width: game.map.width,
                height: game.map.height,
                terrain: game.map.terrain,
                waves: game.map.waves,
                treasures: game.map.treasures,
                bases: game.map.bases,
                traps: game.runtimeState?.traps || []
            }
        });
    }
    catch (error) {
        console.error('Error updating game map:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
