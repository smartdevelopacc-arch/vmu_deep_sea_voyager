"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropTreasure = exports.pickTreasure = exports.rest = exports.trap = exports.move = void 0;
const playerAction_model_1 = require("../models/playerAction.model");
const game_model_1 = require("../models/game.model");
/**
 * Chuyển đổi direction thành target position
 */
const getTargetPosition = (currentPos, direction) => {
    const directionMap = {
        'north': { x: 0, y: -1 },
        'south': { x: 0, y: 1 },
        'east': { x: 1, y: 0 },
        'west': { x: -1, y: 0 }
    };
    const delta = directionMap[direction.toLowerCase()];
    if (!delta) {
        throw new Error(`Invalid direction: ${direction}. Must be north, south, east, or west`);
    }
    return {
        x: currentPos.x + delta.x,
        y: currentPos.y + delta.y
    };
};
const move = async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        const { direction, target } = req.body;
        // Verify game exists
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Hỗ trợ cả direction (user-friendly) và target (raw position)
        let moveTarget = target;
        if (direction) {
            // Lấy vị trí hiện tại của player từ DB (DB schema uses 'code' field)
            const player = game.players.find((p) => (p.code || p.playerId) === playerId);
            if (!player) {
                return res.status(404).json({ error: 'Player not found' });
            }
            moveTarget = getTargetPosition(player.position, direction);
        }
        if (!moveTarget) {
            return res.status(400).json({ error: 'Either direction or target position is required' });
        }
        // Lưu action vào MongoDB
        const action = await playerAction_model_1.PlayerActionModel.create({
            gameId,
            playerId,
            actionType: 'move',
            data: { target: moveTarget },
            status: 'pending'
        });
        res.json({ success: true, actionId: action._id, target: moveTarget });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.move = move;
const trap = async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        const { danger, position } = req.body;
        // Validate danger value
        if (danger === undefined || danger === null) {
            return res.status(400).json({ error: 'Danger value is required' });
        }
        if (typeof danger !== 'number' || danger < 0) {
            return res.status(400).json({ error: 'Danger must be a positive number' });
        }
        // Verify game and player
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        console.log(`🔍 Looking for player: ${playerId}`);
        console.log(`🔍 Available players:`, game.players.map((p) => ({ code: p.code, playerId: p.playerId })));
        // Tìm player theo cả playerId và code
        const player = game.players.find((p) => p.playerId === playerId || p.code === playerId);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        // Use provided position or player's current position
        const trapPosition = position || player.position;
        console.log(`🪤 Trap action received: playerId=${playerId}, position=(${trapPosition.x}, ${trapPosition.y}), danger=${danger}`);
        // Lưu action vào MongoDB
        const action = await playerAction_model_1.PlayerActionModel.create({
            gameId,
            playerId,
            actionType: 'trap',
            data: { position: trapPosition, danger },
            status: 'pending'
        });
        console.log(`✅ Trap action saved: actionId=${action._id}`);
        res.json({ success: true, actionId: action._id, position: trapPosition, danger });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.trap = trap;
const rest = async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        // Verify game exists
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Lưu action vào MongoDB
        const action = await playerAction_model_1.PlayerActionModel.create({
            gameId,
            playerId,
            actionType: 'rest',
            status: 'pending'
        });
        res.json({ success: true, actionId: action._id });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.rest = rest;
const pickTreasure = async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        // Verify game exists
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Lưu action vào MongoDB
        const action = await playerAction_model_1.PlayerActionModel.create({
            gameId,
            playerId,
            actionType: 'pick-treasure',
            status: 'pending'
        });
        res.json({ success: true, actionId: action._id });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.pickTreasure = pickTreasure;
const dropTreasure = async (req, res) => {
    try {
        const { gameId, playerId } = req.params;
        // Verify game exists
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        // Lưu action vào MongoDB
        const action = await playerAction_model_1.PlayerActionModel.create({
            gameId,
            playerId,
            actionType: 'drop-treasure',
            status: 'pending'
        });
        res.json({ success: true, actionId: action._id });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.dropTreasure = dropTreasure;
