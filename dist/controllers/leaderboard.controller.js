"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaderboard = void 0;
const game_model_1 = require("../models/game.model");
const getLeaderboard = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Sử dụng scores từ DB hoặc player scores
        let leaderboard;
        if (game.scores && game.scores.length > 0) {
            leaderboard = game.scores
                .map((s) => ({ playerId: s.playerId, score: s.score }))
                .sort((a, b) => b.score - a.score);
        }
        else {
            leaderboard = game.players
                .map((p) => ({ playerId: p.playerId, score: p.score || 0 }))
                .sort((a, b) => b.score - a.score);
        }
        res.json({ leaderboard });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getLeaderboard = getLeaderboard;
