"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResult = void 0;
const game_model_1 = require("../models/game.model");
const getResult = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Chỉ trả về result khi game đã kết thúc
        if (game.status !== 'finished') {
            return res.status(400).json({
                error: 'Game not finished yet',
                status: game.status,
                currentTurn: game.currentTurn
            });
        }
        // Tính toán kết quả cuối cùng từ players
        const players = game.players
            .map((p) => ({
            playerId: p.playerId,
            score: p.score || 0,
            energy: p.energy,
            trapCount: p.trapCount
        }))
            .sort((a, b) => b.score - a.score);
        const winner = players[0];
        res.json({
            status: game.status,
            totalTurns: game.currentTurn,
            winner: winner.playerId,
            finalScores: players
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getResult = getResult;
