"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompleteGameState = exports.getGameStatus = void 0;
const gamePersistence_1 = require("../core/gamePersistence");
/**
 * GET /game/:gameId/status
 * Returns minimal game status info
 */
const getGameStatus = async (req, res) => {
    try {
        const { gameId } = req.params;
        // Đọc trực tiếp từ MongoDB thay vì gọi worker
        const gameState = await (0, gamePersistence_1.loadGameState)(gameId);
        if (!gameState) {
            return res.status(404).json({ error: 'Game not found' });
        }
        res.json({
            status: gameState.status,
            currentTurn: gameState.currentTurn
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getGameStatus = getGameStatus;
/**
 * GET /game/:gameId/state
 * Returns complete dynamic game state (for bots)
 * Combines map, players, and status in one call
 */
const getCompleteGameState = async (req, res) => {
    try {
        const { gameId } = req.params;
        const gameState = await (0, gamePersistence_1.loadGameState)(gameId);
        if (!gameState) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Convert players Map to array
        const playersArray = Array.from(gameState.players.values()).map((p) => ({
            playerId: p.playerId,
            code: p.code,
            position: p.position,
            energy: p.energy,
            score: p.score,
            carriedTreasure: p.carriedTreasure || 0
        }));
        res.json({
            currentTurn: gameState.currentTurn,
            status: gameState.status,
            treasures: gameState.map.treasures,
            owners: gameState.map.owners,
            players: playersArray
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getCompleteGameState = getCompleteGameState;
