"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAllActiveGames = exports.deleteGameState = exports.loadGameState = exports.saveGameState = void 0;
const game_model_1 = require("../models/game.model");
/**
 * Lưu hoặc cập nhật game state vào MongoDB
 */
const saveGameState = async (gameState) => {
    try {
        console.log(`[DEBUG] Saving game state for ${gameState.gameId}...`);
        // Chuyển đổi Map thành Array để lưu vào MongoDB
        const playersArray = Array.from(gameState.players.values()).map((p, index) => ({
            code: p.playerId,
            name: `Player ${p.playerId}`,
            playerId: p.playerId,
            position: p.position,
            energy: p.energy,
            score: p.score,
            carriedTreasure: p.carriedTreasure,
            trapCount: p.trapCount,
            moveHistory: []
        }));
        console.log(`[DEBUG] Players array: ${playersArray.length} players`);
        // Chuyển đổi traps Map thành array of [x, y, danger, playerId]
        const trapsArray = Array.from(gameState.map.traps.values()).map((trap) => [trap.position?.x || 0, trap.position?.y || 0, trap.danger || 0, trap.playerId || '']);
        console.log(`[DEBUG] 🪤 Traps to save: ${trapsArray.length} traps`);
        if (trapsArray.length > 0) {
            console.log(`[DEBUG] 🪤 First trap:`, trapsArray[0]);
        }
        // Tìm và cập nhật hoặc tạo mới
        const existingGame = await game_model_1.GameModel.findOne({ code: gameState.gameId });
        if (existingGame) {
            console.log(`[DEBUG] Updating existing game ${gameState.gameId}`);
            // Cập nhật game hiện có
            existingGame.status = gameState.status;
            existingGame.currentTurn = gameState.currentTurn;
            existingGame.players = playersArray;
            // Cập nhật settings nếu có
            if (gameState.settings) {
                existingGame.settings = gameState.settings;
            }
            // Save to runtimeState if playing, otherwise to map
            if (gameState.status === 'playing') {
                existingGame.runtimeState = {
                    treasures: gameState.map.treasures,
                    owners: gameState.map.owners,
                    traps: trapsArray
                };
                existingGame.markModified('runtimeState');
                console.log(`[DEBUG] 💾 Saving to runtimeState: ${gameState.map.treasures.flat().filter((t) => t > 0).length} treasures, ${trapsArray.length} traps`);
            }
            // NOTE: Do NOT modify game.map when not playing - it's the initial config
            await existingGame.save();
            console.log(`[DEBUG] ✅ Updated game ${gameState.gameId} successfully`);
            // Verify save
            const verifyGame = await game_model_1.GameModel.findOne({ code: gameState.gameId }).lean();
            if (gameState.status === 'playing' && verifyGame?.runtimeState) {
                const savedTreasures = verifyGame.runtimeState.treasures.flat().filter((t) => t > 0).length;
                console.log(`[DEBUG] 💎 Verified in DB runtimeState: ${savedTreasures} treasures`);
            }
        }
        else {
            console.log(`[DEBUG] Creating new game ${gameState.gameId}`);
            console.log(`[DEBUG] Map size: ${gameState.map.width}x${gameState.map.height}`);
            console.log(`[DEBUG] Terrain: ${gameState.map.terrain?.length || 0} rows`);
            console.log(`[DEBUG] Waves: ${gameState.map.waves?.length || 0} rows`);
            // Tạo game mới
            const newGame = new game_model_1.GameModel({
                code: gameState.gameId,
                name: `Game ${gameState.gameId}`,
                disable: false,
                secret_key: 'auto-generated',
                status: gameState.status,
                currentTurn: gameState.currentTurn,
                settings: gameState.settings || {},
                map: {
                    code: `map-${gameState.gameId}`,
                    name: `Map for ${gameState.gameId}`,
                    width: gameState.map.width,
                    height: gameState.map.height,
                    disable: false,
                    terrain: gameState.map.terrain,
                    waves: gameState.map.waves,
                    treasures: gameState.map.treasures,
                    bases: gameState.map.bases.map(b => [b.x, b.y]),
                    owners: gameState.map.owners,
                    traps: trapsArray,
                    history: []
                },
                players: playersArray,
                scores: [],
                history: []
            });
            await newGame.save();
            console.log(`[DEBUG] ✅ Created new game ${gameState.gameId} successfully`);
        }
    }
    catch (error) {
        console.error(`❌ Failed to save game state for ${gameState.gameId}:`, error);
        throw error; // Re-throw để caller biết có lỗi
    }
};
exports.saveGameState = saveGameState;
/**
 * Load game state từ MongoDB
 */
const loadGameState = async (gameId) => {
    try {
        const game = await game_model_1.GameModel.findOne({ code: gameId });
        if (!game) {
            return null;
        }
        // Chuyển đổi từ MongoDB document sang in-memory state
        const players = new Map();
        game.players.forEach((p) => {
            // Sử dụng 'code' từ DB schema, đó là playerId
            const playerId = p.code || p.playerId;
            // Tính score từ scores array hoặc từ player document
            let playerScore = p.score || 0;
            if (game.scores && Array.isArray(game.scores)) {
                const scoreEntry = game.scores.find((s) => s.playerId === playerId);
                if (scoreEntry) {
                    playerScore = scoreEntry.score || 0;
                }
            }
            players.set(playerId, {
                playerId: playerId,
                position: p.position,
                energy: p.energy,
                carriedTreasure: p.carriedTreasure,
                trapCount: p.trapCount,
                score: playerScore,
                isAtBase: false
            });
        });
        // Ensure terrain and waves are properly initialized
        const width = game.map?.width || 0;
        const height = game.map?.height || 0;
        const terrain = game.map?.terrain || Array(height).fill(0).map(() => Array(width).fill(0));
        const waves = game.map?.waves || Array(height).fill(0).map(() => Array(width).fill(1));
        // Use runtimeState if game is playing, otherwise use initial map config
        const usesRuntimeState = game.status === 'playing' && game.runtimeState;
        const treasures = usesRuntimeState
            ? game.runtimeState.treasures
            : (game.map?.treasures || Array(height).fill(0).map(() => Array(width).fill(0)));
        // Convert owners to string[][] if it's number[][] (backward compatibility)
        let owners = Array(height).fill('').map(() => Array(width).fill(''));
        if (usesRuntimeState && game.runtimeState.owners) {
            owners = game.runtimeState.owners;
        }
        else if (game.map?.owners) {
            owners = game.map.owners.map((row) => row.map((cell) => typeof cell === 'number' ? '' : cell));
        }
        // Load traps from runtimeState if available
        const traps = new Map();
        const trapSource = usesRuntimeState ? game.runtimeState.traps : game.map?.traps;
        if (trapSource) {
            trapSource.forEach((trap, index) => {
                traps.set(`trap-${index}`, trap);
            });
        }
        if (usesRuntimeState) {
            console.log(`📊 Loading runtime state: ${treasures.flat().filter(t => t > 0).length} treasures remaining`);
        }
        const gameState = {
            gameId: game.code,
            status: game.status,
            currentTurn: game.currentTurn || 0,
            players,
            map: {
                width,
                height,
                terrain,
                waves,
                treasures,
                traps,
                bases: (game.map?.bases || []).map((b) => Array.isArray(b) ? { x: b[0], y: b[1] } : b),
                owners
            },
            actionQueue: [],
            settings: game.settings || {}
        };
        return gameState;
    }
    catch (error) {
        console.error('Failed to load game state:', error);
        return null;
    }
};
exports.loadGameState = loadGameState;
/**
 * Xóa game khỏi database
 */
const deleteGameState = async (gameId) => {
    try {
        await game_model_1.GameModel.deleteOne({ code: gameId });
    }
    catch (error) {
        console.error('Failed to delete game state:', error);
    }
};
exports.deleteGameState = deleteGameState;
/**
 * Lấy tất cả games đang active
 */
const loadAllActiveGames = async () => {
    try {
        const games = await game_model_1.GameModel.find({
            status: { $in: ['waiting', 'playing'] }
        });
        const gameStates = [];
        for (const game of games) {
            const state = await (0, exports.loadGameState)(game.code);
            if (state) {
                gameStates.push(state);
            }
        }
        return gameStates;
    }
    catch (error) {
        console.error('Failed to load active games:', error);
        return [];
    }
};
exports.loadAllActiveGames = loadAllActiveGames;
