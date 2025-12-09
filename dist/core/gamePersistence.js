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
            code: p.code || p.playerId,
            name: p.name || `Player ${p.playerId}`,
            logo: p.logo,
            slogan: p.slogan, // ✅ INCLUDE SLOGAN - was missing!
            playerId: p.playerId,
            position: p.position,
            energy: p.energy,
            score: p.score,
            carriedTreasure: p.carriedTreasure,
            trapCount: p.trapCount,
            isAtBase: p.isAtBase,
            moveHistory: []
        }));
        console.log(`[DEBUG] Players array: ${playersArray.length} players`);
        // Chuyển đổi traps Map thành array of objects for storage
        const trapsArray = Array.from(gameState.map.traps.values()).map((trap) => ({
            position: trap.position || { x: 0, y: 0 },
            danger: trap.danger || 0,
            playerId: trap.playerId || '',
            createdAt: trap.createdAt || Date.now()
        }));
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
            // ✅ PRESERVE SETTINGS - if gameState has settings, update; otherwise keep existing
            if (gameState.settings && Object.keys(gameState.settings).length > 0) {
                existingGame.settings = gameState.settings;
                console.log(`[DEBUG] 📝 Updated settings:`, gameState.settings);
            }
            else if (!existingGame.settings) {
                // Ensure settings object exists even if empty
                existingGame.settings = {};
            }
            // If gameState.settings is empty but DB has settings, keep DB settings (markModified will preserve it)
            // Make sure Mongoose knows settings may have changed
            existingGame.markModified('settings');
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
        // Tính trapCount từ traps thực tế trong runtimeState/map để tránh lệch so với DB
        const trapCountByPlayer = new Map();
        const trapSourceForCount = game.status === 'playing' && game.runtimeState?.traps
            ? game.runtimeState.traps
            : game.map?.traps || [];
        if (trapSourceForCount) {
            trapSourceForCount.forEach((trap) => {
                const ownerId = Array.isArray(trap) ? trap[3] : trap?.playerId;
                if (!ownerId)
                    return;
                trapCountByPlayer.set(ownerId, (trapCountByPlayer.get(ownerId) || 0) + 1);
            });
        }
        // Chuyển đổi từ MongoDB document sang in-memory state
        const players = new Map();
        const bases = game.map?.bases || [];
        game.players.forEach((p, playerIndex) => {
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
            // Force player về base CHỈ KHI game mới start (turn = 0)
            let playerPosition = p.position;
            let playerIsAtBase = p.isAtBase ?? false;
            // CHỈ force về base nếu là lần đầu game start (currentTurn = 0)
            if ((game.status === 'playing' || game.status === 'waiting') && game.currentTurn === 0) {
                if (playerIndex < bases.length) {
                    const basePos = bases[playerIndex];
                    playerPosition = Array.isArray(basePos) ? { x: basePos[0], y: basePos[1] } : basePos;
                    playerIsAtBase = true;
                    console.log(`🏁 Game ${gameId} turn 0: Forcing player ${p.code} to base at (${playerPosition.x}, ${playerPosition.y})`);
                }
            }
            players.set(playerId, {
                playerId: playerId,
                code: p.code || playerId, // ✅ ENHANCED: Include code for leaderboard display
                name: p.name || `Player ${p.code || playerId}`, // ✅ ENHANCED: Include name for UI
                logo: p.logo, // ✅ ENHANCED: Include logo
                slogan: p.slogan, // ✅ ENHANCED: Include slogan for leaderboard
                position: playerPosition,
                energy: p.energy || 100,
                carriedTreasure: p.carriedTreasure,
                trapCount: trapCountByPlayer.get(playerId) || p.trapCount || 0,
                score: playerScore,
                isAtBase: playerIsAtBase,
                baseIndex: playerIndex // ✅ ENHANCED: Store base index for reliable base assignment
                // NOTE: secret is NOT stored here - validated from global Player collection only
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
                // Handle both object and array formats for backward compatibility
                let trapObj;
                if (Array.isArray(trap)) {
                    // Old flat array format [x, y, danger, playerId, createdAt]
                    trapObj = {
                        position: { x: trap[0], y: trap[1] },
                        danger: trap[2],
                        playerId: trap[3],
                        createdAt: trap[4] || Date.now()
                    };
                }
                else {
                    // Object format - use as-is
                    trapObj = trap;
                }
                // Use position coordinates as key for quick access
                const key = trapObj.position ? `${trapObj.position.x},${trapObj.position.y}` : `trap-${index}`;
                traps.set(key, trapObj);
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
        console.log(`[DEBUG] 📋 Loaded game ${gameId} settings from DB:`, gameState.settings);
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
