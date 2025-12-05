"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMap = exports.getGameConfig = void 0;
const game_model_1 = require("../models/game.model");
/**
 * GET /game/:gameId/config
 * Returns static game configuration that never changes
 */
const getGameConfig = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Static configuration only
        res.json({
            width: game.map.width,
            height: game.map.height,
            terrain: game.map.terrain,
            waves: game.map.waves,
            treasures: game.map.treasures,
            bases: game.map.bases,
            traps: game.runtimeState?.traps || [],
            settings: {
                enableTraps: game.settings?.enableTraps ?? true,
                maxTurns: game.settings?.maxTurns,
                timeLimitMs: game.settings?.timeLimitMs
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getGameConfig = getGameConfig;
/**
 * GET /game/:gameId/map
 * Returns dynamic map state (treasures, owners, current turn)
 * Uses runtimeState if game is playing, otherwise initial config
 */
const getMap = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Use runtimeState if game is playing
        const usesRuntimeState = game.status === 'playing' && game.runtimeState;
        const treasures = usesRuntimeState && game.runtimeState
            ? game.runtimeState.treasures
            : game.map.treasures;
        const owners = usesRuntimeState && game.runtimeState
            ? game.runtimeState.owners
            : game.map.owners;
        // Dynamic state only - không bao gồm thông tin bẫy (traps)
        res.json({
            currentTurn: game.currentTurn,
            treasures,
            owners
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getMap = getMap;
