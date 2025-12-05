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
 * Public: Get current game settings
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
 * Admin-only endpoints for updating settings/map have been moved to /api/admin routes
 * See: /src/routes/worker.routes.ts for:
 * - PUT /api/admin/game/:gameId/settings
 * - PUT /api/admin/game/:gameId/map
 */
exports.default = router;
