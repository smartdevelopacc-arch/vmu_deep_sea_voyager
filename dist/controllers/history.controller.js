"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = void 0;
const game_model_1 = require("../models/game.model");
const getHistory = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Trả về history từ DB
        res.json({
            currentTurn: game.currentTurn,
            history: game.history || []
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getHistory = getHistory;
