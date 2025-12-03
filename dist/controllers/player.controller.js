"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayers = void 0;
const game_model_1 = require("../models/game.model");
const getPlayers = async (req, res) => {
    try {
        const { gameId } = req.params;
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        const players = game.players.map((p) => ({
            playerId: p.code || p.playerId, // DB schema uses 'code' field
            position: p.position,
            energy: p.energy,
            carriedTreasure: p.carriedTreasure,
            trapCount: p.trapCount,
            score: p.score
        }));
        res.json({ players });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getPlayers = getPlayers;
