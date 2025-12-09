"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompleteGameState = exports.getGameStatus = void 0;
const gamePersistence_1 = require("../core/gamePersistence");
const game_model_1 = require("../models/game.model");
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
 * GET /game/:gameId/state?playerId=xxx
 * Returns complete dynamic game state (for bots)
 * Combines map, players, and status in one call
 * ✅ ENHANCED: Only returns traps belonging to the requesting player
 */
const getCompleteGameState = async (req, res) => {
    try {
        const { gameId } = req.params;
        const { playerId } = req.query; // Get playerId from query parameter
        const gameState = await (0, gamePersistence_1.loadGameState)(gameId);
        if (!gameState) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // ✅ ENHANCED: Also fetch game from DB to get complete player info with names
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        // Convert players Map to array
        // ✅ ENHANCED: Include name/teamName/slogan for leaderboard display by enriching from DB
        const playersArray = Array.from(gameState.players.values()).map((p, index) => {
            // Get enriched player info from DB if available
            const dbPlayer = game?.players?.[index];
            return {
                playerId: p.playerId,
                code: p.code,
                name: p.name || dbPlayer?.name || p.code, // Use name from runtime state first, fallback to DB
                logo: dbPlayer?.logo || p.logo, // Include team logo
                position: p.position,
                energy: p.energy,
                score: p.score,
                carriedTreasure: p.carriedTreasure || 0,
                trapCount: p.trapCount || 0,
                slogan: dbPlayer?.slogan || p.slogan || '' // ✅ INCLUDE SLOGAN from DB player
            };
        });
        // Only return traps belonging to the requesting player
        const trapsArray = Array.from(gameState.map.traps.values())
            .filter((t) => t.playerId === playerId)
            .map((t) => ({
            position: t.position,
            danger: t.danger,
            playerId: t.playerId,
            createdAt: t.createdAt
        }));
        res.json({
            currentTurn: gameState.currentTurn,
            status: gameState.status,
            treasures: gameState.map.treasures,
            owners: gameState.map.owners,
            traps: trapsArray,
            map: {
                width: gameState.map.width,
                height: gameState.map.height,
                terrain: gameState.map.terrain,
                waves: gameState.map.waves,
                bases: gameState.map.bases
            },
            players: playersArray
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getCompleteGameState = getCompleteGameState;
