"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllGames = exports.getGameState = exports.stopGame = exports.queueAction = exports.startGame = exports.initializeGame = void 0;
const socketEvents_1 = require("./socketEvents");
const gamePersistence_1 = require("./gamePersistence");
const playerAction_model_1 = require("../models/playerAction.model");
const game_model_1 = require("../models/game.model");
// Cấu hình game loop từ biến môi trường
const TICK_INTERVAL = parseInt(process.env.GAME_TICK_INTERVAL || '500');
const MAX_TURNS = parseInt(process.env.GAME_MAX_TURNS || '1200');
const MAX_ENERGY = parseInt(process.env.GAME_MAX_ENERGY || '100');
const ENERGY_RESTORE = parseInt(process.env.GAME_ENERGY_RESTORE || '10');
const MAX_TRAPS_PER_PLAYER = parseInt(process.env.GAME_MAX_TRAPS_PER_PLAYER || '5');
const MAX_TRAP_DANGER = parseInt(process.env.GAME_MAX_TRAP_DANGER || '50');
const TIME_LIMIT_MS = parseInt(process.env.GAME_TIME_LIMIT_MS || '300000'); // 5 phút mặc định
const ENABLE_TRAPS = process.env.GAME_ENABLE_TRAPS !== 'false'; // Mặc định true
const resolveSettings = (source) => {
    const s = (source && typeof source === 'object' && 'settings' in source) ? source.settings : source;
    return {
        enableTraps: s?.enableTraps ?? ENABLE_TRAPS,
        maxEnergy: s?.maxEnergy ?? MAX_ENERGY,
        energyRestore: s?.energyRestore ?? ENERGY_RESTORE,
        maxTurns: s?.maxTurns ?? MAX_TURNS,
        timeLimitMs: s?.timeLimitMs ?? TIME_LIMIT_MS,
        tickIntervalMs: s?.tickIntervalMs ?? TICK_INTERVAL
    };
};
const getSettingsFromState = (gameState) => resolveSettings(gameState?.settings);
// Chỉ track gameIds đang chạy và intervalIds - KHÔNG LƯU FULL STATE
const activeGameIntervals = new Map();
/**
 * Khởi tạo game mới - CHỈ LƯU VÀO DB
 */
const initializeGame = async (gameId, mapData, players) => {
    // Normalize bases: convert [x, y] to {x, y} if needed
    const bases = mapData.bases.map((b) => Array.isArray(b) ? { x: b[0], y: b[1] } : b);
    // Ensure waves exists
    const waves = mapData.waves || Array(mapData.height).fill(0).map(() => Array(mapData.width).fill(1));
    const gameState = {
        gameId,
        status: 'waiting',
        currentTurn: 0,
        players: new Map(),
        map: {
            width: mapData.width,
            height: mapData.height,
            terrain: mapData.terrain,
            waves: waves,
            treasures: mapData.treasures,
            traps: new Map(),
            bases: bases,
            // Preserve owners grid from map data if provided (supports number[][] or string[][])
            owners: mapData.owners && Array.isArray(mapData.owners)
                ? mapData.owners
                : Array(mapData.height).fill(0).map(() => Array(mapData.width).fill(0))
        },
        actionQueue: [],
        settings: resolveSettings(mapData?.settings)
    };
    // Khởi tạo players tại các căn cứ
    const initialSettings = getSettingsFromState(gameState);
    players.forEach((player, index) => {
        const basePosition = bases[index];
        const maxEnergy = initialSettings.maxEnergy ?? MAX_ENERGY;
        gameState.players.set(player.playerId, {
            playerId: player.playerId,
            code: player.code,
            name: player.name,
            logo: player.logo,
            slogan: player.slogan, // ✅ INCLUDE SLOGAN!
            position: basePosition,
            energy: maxEnergy,
            trapCount: 0,
            score: 0,
            isAtBase: true
        });
    });
    // Lưu vào database - KHÔNG LƯU MEMORY
    await (0, gamePersistence_1.saveGameState)(gameState);
    console.log(`🎮 Game ${gameId} initialized in DB`);
    return gameState;
};
exports.initializeGame = initializeGame;
/**
 * Bắt đầu game loop - CHỈ UPDATE DB VÀ TRACK INTERVAL
 */
const startGame = async (gameId) => {
    const startTime = Date.now();
    // Load game để lấy tick interval từ settings
    const game = await game_model_1.GameModel.findOne({ code: gameId });
    if (!game) {
        throw new Error(`Game ${gameId} not found`);
    }
    const effectiveSettings = resolveSettings(game);
    const tickInterval = effectiveSettings.tickIntervalMs;
    // Clone initial map config vào runtimeState
    const runtimeState = {
        treasures: JSON.parse(JSON.stringify(game.map.treasures)),
        owners: JSON.parse(JSON.stringify(game.map.owners)),
        traps: [] // Traps sẽ được thêm trong quá trình chơi
    };
    console.log(`🎮 Initializing runtime state: ${runtimeState.treasures.flat().filter((t) => t > 0).length} treasures`);
    // Update status trong DB với runtimeState - ĐẢM BẢO SETTINGS ĐƯỢC GIỮ LẠI
    console.log(`[DEBUG] 🎬 startGame: Saving settings to DB:`, game.settings);
    await game_model_1.GameModel.updateOne({ code: gameId }, {
        $set: {
            status: 'playing',
            currentTurn: 0,
            startTime,
            runtimeState,
            settings: game.settings || {} // ✅ EXPLICITLY PRESERVE SETTINGS
        }
    });
    // Tạo interval để xử lý mỗi tick với interval từ settings
    const intervalId = setInterval(() => {
        console.log(`[Loop] Tick interval fired for ${gameId} @ ${new Date().toISOString()}`);
        processTick(gameId);
    }, tickInterval);
    // Track interval ID để có thể stop sau
    activeGameIntervals.set(gameId, intervalId);
    console.log(`🎮 Game ${gameId} started at ${new Date(startTime).toISOString()} with ${tickInterval}ms interval`);
};
exports.startGame = startGame;
/**
 * Poll actions từ MongoDB và thêm vào queue
 */
const pollActionsFromDB = async (gameId, gameState) => {
    try {
        // Lấy tất cả actions pending cho game này
        const pendingActions = await playerAction_model_1.PlayerActionModel.find({
            gameId,
            status: 'pending'
        }).sort({ timestamp: 1 }).limit(100); // Limit để tránh overload
        console.log(`[📥 Poll] Found ${pendingActions.length} pending actions for ${gameId}`);
        for (const action of pendingActions) {
            try {
                console.log(`[📥 Poll] Processing action: ${action.actionType} from ${action.playerId}`, action.data);
                // Thêm vào action queue
                gameState.actionQueue.push({
                    playerId: action.playerId,
                    type: action.actionType,
                    timestamp: action.timestamp.getTime(),
                    data: action.data
                });
                // Đánh dấu đã xử lý
                action.status = 'processed';
                action.processedAt = new Date();
                await action.save();
            }
            catch (err) {
                // Đánh dấu failed nếu có lỗi
                action.status = 'failed';
                action.error = err.message;
                await action.save();
                console.error(`Failed to process action ${action._id}:`, err);
            }
        }
    }
    catch (err) {
        console.error('Failed to poll actions from DB:', err);
    }
};
/**
 * Xử lý mỗi tick/lượt - LOAD TỪ DB, XỬ LÝ, SAVE LẠI DB
 */
const processTick = async (gameId) => {
    try {
        console.log(`[Loop] processTick START for ${gameId}`);
        // BƯỚC 1: Load game state từ MongoDB
        const gameState = await (0, gamePersistence_1.loadGameState)(gameId);
        if (!gameState || gameState.status !== 'playing') {
            return;
        }
        gameState.currentTurn++;
        // Count remaining treasures for monitoring
        let remainingTreasures = 0;
        for (let y = 0; y < gameState.map.treasures.length; y++) {
            for (let x = 0; x < gameState.map.treasures[y].length; x++) {
                if (gameState.map.treasures[y][x] > 0)
                    remainingTreasures++;
            }
        }
        console.log(`🎮 Game ${gameId} - Turn ${gameState.currentTurn} starting - Remaining treasures: ${remainingTreasures}`);
        // Kiểm tra điều kiện kết thúc
        const settings = getSettingsFromState(gameState);
        if (shouldEndGame(gameState, settings)) {
            await endGame(gameId);
            return;
        }
        // Phát sự kiện lượt mới
        (0, socketEvents_1.emitNewTurn)(gameId, gameState.currentTurn);
        // BƯỚC 2: Poll tất cả actions pending từ MongoDB
        await pollActionsFromDB(gameId, gameState);
        // BƯỚC 3: Sắp xếp và xử lý tất cả actions trong queue
        gameState.actionQueue.sort((a, b) => a.timestamp - b.timestamp);
        const actions = [...gameState.actionQueue];
        gameState.actionQueue = []; // Clear queue
        // Track players bị đâm về base để huỷ action tiếp theo
        const playersRammedThisTick = new Set();
        // Track players có action trong turn này
        const playersWithActions = new Set();
        actions.forEach(action => {
            // Skip action nếu player đã bị đâm về base trong tick này
            if (playersRammedThisTick.has(action.playerId)) {
                console.log(`⚠️ Player ${action.playerId} was rammed this tick - skipping remaining actions`);
                return;
            }
            playersWithActions.add(action.playerId);
            processAction(gameState, action, playersRammedThisTick);
        });
        // BƯỚC 3.5: Hồi năng lượng cho players KHÔNG có action (tự động nghỉ)
        const energyRestore = settings.energyRestore ?? ENERGY_RESTORE;
        const maxEnergy = settings.maxEnergy ?? MAX_ENERGY;
        gameState.players.forEach((player, playerId) => {
            if (!playersWithActions.has(playerId) && !player.isAtBase) {
                // Player không có action và không ở base -> tự động hồi năng lượng
                player.energy = Math.min(player.energy + energyRestore, maxEnergy);
                (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
            }
        });
        // BƯỚC 4: Cập nhật trạng thái bản đồ
        updateMapState(gameState);
        // BƯỚC 5: Lưu game state vào MongoDB
        await (0, gamePersistence_1.saveGameState)(gameState);
        // BƯỚC 6: Thông báo đồng bộ hoàn tất - Client nên fetch lại state
        const { emitTickComplete } = require('./socketEvents');
        emitTickComplete(gameId, gameState.currentTurn);
        console.log(`✅ Tick ${gameState.currentTurn} completed for game ${gameId} - ${actions.length} actions processed`);
    }
    catch (error) {
        console.error(`❌ Error processing tick for game ${gameId}:`, error);
    }
};
/**
 * Queue action - ĐÃ DEPRECATED, actions được lưu trực tiếp vào DB bởi server
 * Function này giữ lại để backward compatibility
 */
const queueAction = async (gameId, action) => {
    // Không còn dùng in-memory queue
    console.warn('queueAction is deprecated. Actions should be saved to DB via PlayerActionModel');
    return false;
};
exports.queueAction = queueAction;
/**
 * Xử lý từng action
 */
const processAction = (gameState, action, playersRammedThisTick) => {
    const player = gameState.players.get(action.playerId);
    if (!player)
        return;
    switch (action.type) {
        case 'move':
            processMove(gameState, player, action.data, playersRammedThisTick);
            break;
        case 'trap':
            processTrap(gameState, player, action.data);
            break;
        case 'rest':
            processRest(gameState, player);
            break;
    }
};
/**
 * Xử lý di chuyển
 *
 * Flow:
 * 1. Validate target position (bounds, terrain)
 * 2. Calculate energy cost (wave value)
 * 3. Check for collision with other players
 * 4. Move player to new position
 * 5. Check and trigger traps
 * 6. AUTO-COLLECT treasure if present at new position
 * 7. AUTO-DROP treasure and score points if reached base
 * 8. Restore energy if at base
 */
const processMove = (gameState, player, data, playersRammedThisTick) => {
    const { target } = data;
    // Kiểm tra vị trí hợp lệ
    if (!isValidPosition(gameState.map, target)) {
        return;
    }
    // Kiểm tra địa hình (đảo/đá ngầm) với validation
    if (gameState.map.terrain?.[target.y]?.[target.x] === -1) {
        return;
    }
    // Kiểm tra không được di chuyển vào base của đối thủ
    if (isEnemyBase(gameState, target, player.playerId)) {
        console.log(`🚫 Player ${player.playerId} cannot move to enemy base at (${target.x}, ${target.y})`);
        return;
    }
    // Tính chi phí năng lượng với validation
    const waveCost = gameState.map.waves?.[target.y]?.[target.x] || 1;
    if (player.energy < waveCost) {
        return; // Không đủ năng lượng
    }
    // Kiểm tra tranh chấp ô đích
    const conflictPlayer = findPlayerAtPosition(gameState, target);
    if (conflictPlayer && conflictPlayer.playerId !== player.playerId) {
        // Va chạm: player chủ động, conflictPlayer bị động
        handleCollision(gameState, player, conflictPlayer, playersRammedThisTick);
        // Attacker chiếm lấy vị trí của victim (sau khi victim bị đá về base)
        player.position = { ...target };
        player.energy -= waveCost;
        player.isAtBase = isAtBase(gameState.map, target);
        console.log(`🏃 Player ${player.playerId} occupied position (${target.x}, ${target.y}) after ramming`);
        (0, socketEvents_1.emitPlayerMove)(gameState.gameId, player.playerId, player.position);
        (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
        return;
    }
    // Di chuyển thành công
    player.position = { ...target };
    player.energy -= waveCost;
    player.isAtBase = isAtBase(gameState.map, target);
    // Kiểm tra bẫy
    checkTrap(gameState, player, target);
    // Tự động nhặt treasure nếu ô đích có treasure
    const treasureValue = gameState.map.treasures?.[target.y]?.[target.x];
    if (treasureValue && treasureValue > 0 && !player.carriedTreasure) {
        player.carriedTreasure = treasureValue;
        gameState.map.treasures[target.y][target.x] = 0;
        console.log(`💎 Player ${player.playerId} auto-collected treasure ${treasureValue} at (${target.x}, ${target.y})`);
        (0, socketEvents_1.emitTreasureCollected)(gameState.gameId, player.playerId, treasureValue, target);
    }
    // Tự động drop treasure và tính điểm nếu về base
    const settings = getSettingsFromState(gameState);
    const maxEnergy = settings.maxEnergy ?? MAX_ENERGY;
    if (player.isAtBase && player.carriedTreasure && player.carriedTreasure > 0) {
        player.score += player.carriedTreasure;
        console.log(`🏆 Player ${player.playerId} auto-dropped treasure ${player.carriedTreasure} at base. New score: ${player.score}`);
        (0, socketEvents_1.emitScoreUpdate)(gameState.gameId, player.playerId, player.score);
        const { emitTreasureDropped } = require('./socketEvents');
        emitTreasureDropped(gameState.gameId, player.playerId);
        player.carriedTreasure = 0;
        player.energy = maxEnergy; // Full energy khi về base
    }
    else if (player.isAtBase) {
        // Nạp năng lượng nếu về căn cứ (không mang treasure)
        player.energy = maxEnergy;
    }
    (0, socketEvents_1.emitPlayerMove)(gameState.gameId, player.playerId, player.position);
    (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
};
/**
 * Xử lý đặt bẫy
 */
const processTrap = (gameState, player, data) => {
    const { position, danger } = data;
    // Kiểm tra xem game có cho phép đặt bẫy không
    const settings = getSettingsFromState(gameState);
    const enableTraps = settings.enableTraps ?? ENABLE_TRAPS;
    if (!enableTraps) {
        console.log(`⚠️  Traps are disabled for game ${gameState.gameId}`);
        return;
    }
    // Kiểm tra năng lượng
    if (player.energy <= danger || danger > MAX_TRAP_DANGER) {
        return;
    }
    // Chỉ cho phép đặt trap tại vị trí hiện tại
    if (position.x !== player.position.x || position.y !== player.position.y) {
        console.log(`⚠️  Can only place trap at current position`);
        return;
    }
    // Kiểm tra không đặt trên kho báu, căn cứ, đảo
    if (!canPlaceTrap(gameState, position, player.playerId)) {
        return;
    }
    // Nếu đã có bẫy của chính player ở ô này, chỉ cập nhật danger/createdAt, không tăng count
    const trapKey = `${position.x},${position.y}`;
    const existingTrap = gameState.map.traps.get(trapKey);
    if (existingTrap && existingTrap.playerId === player.playerId) {
        gameState.map.traps.set(trapKey, {
            playerId: player.playerId,
            position,
            danger,
            createdAt: Date.now()
        });
        console.log(`🪤 Trap refreshed at (${position.x}, ${position.y}) by ${player.playerId}, danger=${danger}`);
        (0, socketEvents_1.emitTrapPlaced)(gameState.gameId, player.playerId, position, danger);
        return;
    }
    // Đếm bẫy hiện có của player để enforce cứng theo board thực tế
    const activeTrapCount = countTrapsForPlayer(gameState, player.playerId);
    if (activeTrapCount >= MAX_TRAPS_PER_PLAYER) {
        removeOldestTrap(gameState, player.playerId);
    }
    // Xóa bẫy cũ nếu vượt quá giới hạn
    if (player.trapCount >= MAX_TRAPS_PER_PLAYER) {
        removeOldestTrap(gameState, player.playerId);
    }
    // Đặt bẫy mới
    gameState.map.traps.set(trapKey, {
        playerId: player.playerId,
        position,
        danger,
        createdAt: Date.now() // Track when trap was placed
    });
    console.log(`🪤 Trap placed at (${position.x}, ${position.y}) by ${player.playerId}, danger=${danger}`);
    console.log(`🪤 Total traps in game: ${gameState.map.traps.size}`);
    player.trapCount = countTrapsForPlayer(gameState, player.playerId);
    player.energy -= danger;
    (0, socketEvents_1.emitTrapPlaced)(gameState.gameId, player.playerId, position, danger);
    (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
};
/**
 * Xử lý nghỉ ngơi
 */
const processRest = (gameState, player) => {
    const settings = getSettingsFromState(gameState);
    const energyRestore = settings.energyRestore ?? ENERGY_RESTORE;
    const maxEnergy = settings.maxEnergy ?? MAX_ENERGY;
    player.energy = Math.min(player.energy + energyRestore, maxEnergy);
    (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
};
/**
 * Xử lý va chạm
 */
const handleCollision = (gameState, attacker, victim, playersRammedThisTick) => {
    const victimPosition = { ...victim.position };
    const settings = getSettingsFromState(gameState);
    const maxEnergy = settings.maxEnergy ?? MAX_ENERGY;
    // Nạn nhân về căn cứ - sử dụng baseIndex từ victim state
    const baseIndex = victim.baseIndex ?? 0; // Default to 0 if not set
    victim.position = { ...gameState.map.bases[baseIndex] };
    victim.energy = maxEnergy;
    victim.isAtBase = true;
    // Mark victim as rammed to cancel remaining actions this tick
    playersRammedThisTick.add(victim.playerId);
    console.log(`⚠️ Player ${victim.playerId} rammed back to base at (${victim.position.x}, ${victim.position.y}) - remaining actions this tick will be skipped`);
    // Xử lý kho báu của nạn nhân - rơi tại vị trí va chạm (KHÔNG được cộng điểm)
    if (victim.carriedTreasure && victim.carriedTreasure > 0) {
        const treasureValue = victim.carriedTreasure;
        // Nạn nhân mất treasure (không được cộng điểm)
        console.log(`💎 Player ${victim.playerId} lost treasure (${treasureValue}) due to collision at (${victimPosition.x}, ${victimPosition.y})`);
        // Treasure được chuyển cho attacker
        attacker.carriedTreasure = (attacker.carriedTreasure || 0) + treasureValue;
        console.log(`🎁 Player ${attacker.playerId} received treasure ${treasureValue}. Now carrying: ${attacker.carriedTreasure}`);
        // Clear victim's treasure
        victim.carriedTreasure = 0;
        // Notify UI about treasure change for both players
        const { emitPlayerTreasureUpdate } = require('./socketEvents');
        emitPlayerTreasureUpdate(gameState.gameId, victim.playerId, 0);
        emitPlayerTreasureUpdate(gameState.gameId, attacker.playerId, attacker.carriedTreasure);
    }
    (0, socketEvents_1.emitCollision)(gameState.gameId, attacker.playerId, victim.playerId);
    (0, socketEvents_1.emitPlayerMove)(gameState.gameId, victim.playerId, victim.position);
};
/**
 * Kiểm tra bẫy
 */
const checkTrap = (gameState, player, position) => {
    const trapKey = `${position.x},${position.y}`;
    const trap = gameState.map.traps.get(trapKey);
    if (trap && trap.playerId !== player.playerId) {
        const waveCost = gameState.map.waves[position.y][position.x] || 1;
        player.energy = Math.max(0, player.energy - trap.danger - waveCost);
        gameState.map.traps.delete(trapKey);
        // thông báo UI gỡ bẫy
        (0, socketEvents_1.emitTrapRemoved)(gameState.gameId, position);
        // Keep owner trap count in sync when a trap is consumed
        const owner = gameState.players.get(trap.playerId);
        if (owner) {
            owner.trapCount = countTrapsForPlayer(gameState, trap.playerId);
        }
        (0, socketEvents_1.emitEnergyUpdate)(gameState.gameId, player.playerId, player.energy);
    }
};
/**
 * Cập nhật trạng thái bản đồ
 */
const updateMapState = (gameState) => {
    // Reset owners
    gameState.map.owners = Array(gameState.map.height).fill('').map(() => Array(gameState.map.width).fill(''));
    // Cập nhật vị trí players với playerId
    gameState.players.forEach((player) => {
        const { x, y } = player.position;
        gameState.map.owners[y][x] = player.playerId;
    });
};
/**
 * Kiểm tra điều kiện kết thúc
 */
/**
 * Kiểm tra điều kiện kết thúc game.
 *
 * Game kết thúc khi:
 * 1. Hết thời gian (TIME_LIMIT_MS)
 * 2. Hết số lượt (MAX_TURNS)
 * 3. Hết treasure trên map (tất cả treasures = 0)
 *
 * @param gameState - Current game state
 * @returns true if game should end, false otherwise
 */
const shouldEndGame = (gameState, settings) => {
    const effectiveSettings = settings || getSettingsFromState(gameState);
    const timeLimitMs = effectiveSettings.timeLimitMs ?? TIME_LIMIT_MS;
    const maxTurns = effectiveSettings.maxTurns ?? MAX_TURNS;
    // Kiểm tra thời gian chơi
    if (gameState.startTime) {
        const elapsed = Date.now() - gameState.startTime;
        if (elapsed >= timeLimitMs) {
            console.log(`⏰ Game ${gameState.gameId} time limit reached: ${elapsed}ms >= ${timeLimitMs}ms`);
            return true;
        }
    }
    // Hết số lượt
    if (gameState.currentTurn >= maxTurns) {
        console.log(`🏁 Game ${gameState.gameId} max turns reached: ${gameState.currentTurn} >= ${maxTurns}`);
        return true;
    }
    // Kiểm tra còn treasure không (trên map)
    let treasuresOnMap = 0;
    for (let y = 0; y < gameState.map.treasures.length; y++) {
        for (let x = 0; x < gameState.map.treasures[y].length; x++) {
            if (gameState.map.treasures[y][x] > 0) {
                treasuresOnMap++;
            }
        }
    }
    // Kiểm tra treasure đang được mang bởi players
    let treasuresCarried = 0;
    gameState.players.forEach(player => {
        if (player.carriedTreasure && player.carriedTreasure > 0) {
            treasuresCarried++;
        }
    });
    const totalTreasures = treasuresOnMap + treasuresCarried;
    if (totalTreasures === 0) {
        console.log(`💎 Game ${gameState.gameId} all treasures collected and delivered! (Map: ${treasuresOnMap}, Carried: ${treasuresCarried})`);
        return true;
    }
    // Log treasure status khi còn ít treasure (để dễ debug)
    if (totalTreasures <= 5 || gameState.currentTurn % 10 === 0) {
        console.log(`💎 Game ${gameState.gameId} treasures remaining: ${totalTreasures} (Map: ${treasuresOnMap}, Carried: ${treasuresCarried})`);
    }
    return false;
};
/**
 * Kết thúc game - UPDATE DB VÀ STOP INTERVAL
 */
const endGame = async (gameId) => {
    try {
        console.log(`🏁 Ending game ${gameId}...`);
        // Load game state
        const gameState = await (0, gamePersistence_1.loadGameState)(gameId);
        if (!gameState) {
            console.log(`❌ Cannot end game ${gameId} - not found`);
            return;
        }
        gameState.status = 'finished';
        // Stop interval
        const intervalId = activeGameIntervals.get(gameId);
        if (intervalId) {
            clearInterval(intervalId);
            activeGameIntervals.delete(gameId);
            console.log(`⏹️ Game loop stopped for ${gameId}`);
        }
        const result = {
            scores: getScores(gameState),
            turns: gameState.currentTurn
        };
        // Lưu kết quả cuối cùng vào database
        await (0, gamePersistence_1.saveGameState)(gameState);
        (0, socketEvents_1.emitGameEnd)(gameId, result);
        console.log(`🏁 Game ${gameId} ended successfully - Final scores:`, result.scores);
    }
    catch (error) {
        console.error(`Failed to end game ${gameId}:`, error);
    }
};
/**
 * Dừng game - STOP INTERVAL VÀ UPDATE DB
 */
const stopGame = async (gameId) => {
    await endGame(gameId);
};
exports.stopGame = stopGame;
// Helper functions
const isValidPosition = (map, pos) => {
    return pos.x >= 0 && pos.x < map.width && pos.y >= 0 && pos.y < map.height;
};
const isAtBase = (map, pos) => {
    return map.bases.some(base => {
        const bx = Array.isArray(base) ? base[0] : base.x;
        const by = Array.isArray(base) ? base[1] : base.y;
        return bx === pos.x && by === pos.y;
    });
};
/**
 * Kiểm tra xem vị trí có phải base của một player khác không
 */
const isEnemyBase = (gameState, pos, currentPlayerId) => {
    for (const [playerId, player] of gameState.players) {
        if (playerId === currentPlayerId)
            continue;
        const baseIndex = player.baseIndex ?? 0;
        if (baseIndex >= gameState.map.bases.length)
            continue;
        const base = gameState.map.bases[baseIndex];
        const bx = Array.isArray(base) ? base[0] : base.x;
        const by = Array.isArray(base) ? base[1] : base.y;
        if (bx === pos.x && by === pos.y) {
            return true;
        }
    }
    return false;
};
const isAdjacent = (pos1, pos2) => {
    return Math.abs(pos1.x - pos2.x) <= 1 && Math.abs(pos1.y - pos2.y) <= 1;
};
const canPlaceTrap = (gameState, pos, currentPlayerId) => {
    if (gameState.map.terrain[pos.y][pos.x] === -1)
        return false; // Đảo
    if (gameState.map.treasures[pos.y][pos.x] > 0)
        return false; // Kho báu
    if (isAtBase(gameState.map, pos))
        return false; // Căn cứ
    // Kiểm tra không có player KHÁC đang đứng ở vị trí này (cho phép player hiện tại)
    const playerAtPos = findPlayerAtPosition(gameState, pos);
    if (playerAtPos && playerAtPos.playerId !== currentPlayerId)
        return false;
    return true;
};
const findPlayerAtPosition = (gameState, pos) => {
    return Array.from(gameState.players.values()).find(p => p.position.x === pos.x && p.position.y === pos.y);
};
const removeOldestTrap = (gameState, playerId) => {
    let oldestKey = null;
    let oldestTime = Infinity;
    // Tìm trap cũ nhất của player này
    for (const [key, trap] of gameState.map.traps.entries()) {
        if (trap.playerId === playerId && trap.createdAt < oldestTime) {
            oldestTime = trap.createdAt;
            oldestKey = key;
        }
    }
    if (oldestKey) {
        const trap = gameState.map.traps.get(oldestKey);
        console.log(`🎫 Removing oldest trap at (${trap?.position.x}, ${trap?.position.y}) for ${playerId}`);
        gameState.map.traps.delete(oldestKey);
        if (trap?.position) {
            (0, socketEvents_1.emitTrapRemoved)(gameState.gameId, trap.position);
        }
        // Keep trapCount aligned with active traps on the board
        const owner = gameState.players.get(playerId);
        if (owner) {
            owner.trapCount = countTrapsForPlayer(gameState, playerId);
        }
    }
};
// Đếm số bẫy hiện có của một player trên board
const countTrapsForPlayer = (gameState, playerId) => {
    let count = 0;
    for (const trap of gameState.map.traps.values()) {
        if (trap.playerId === playerId) {
            count++;
        }
    }
    return count;
};
const getScores = (gameState) => {
    return Array.from(gameState.players.values()).map(p => ({
        playerId: p.playerId,
        score: p.score
    }));
};
const getMapSnapshot = (gameState) => {
    return {
        currentTurn: gameState.currentTurn,
        terrain: gameState.map.terrain,
        waves: gameState.map.waves,
        treasures: gameState.map.treasures,
        owners: gameState.map.owners,
        players: Array.from(gameState.players.values()).map(p => ({
            playerId: p.playerId,
            position: p.position,
            energy: p.energy,
            carriedTreasure: p.carriedTreasure,
            score: p.score
        }))
    };
};
/**
 * Lấy game state - LOAD TỪ DB
 */
const getGameState = async (gameId) => {
    return await (0, gamePersistence_1.loadGameState)(gameId);
};
exports.getGameState = getGameState;
/**
 * Lấy tất cả games - QUERY TỪ DB
 */
const getAllGames = async () => {
    const games = await game_model_1.GameModel.find({ status: { $in: ['waiting', 'playing', 'finished'] } })
        .select('code status currentTurn players createdAt')
        .sort({
        status: 1, // waiting < playing < finished (alphabetically)
        createdAt: -1 // newest first within each status
    })
        .limit(100)
        .lean();
    return games.map(game => ({
        gameId: game.code,
        status: game.status,
        currentTurn: game.currentTurn || 0,
        playerCount: game.players?.length || 0,
        isActive: activeGameIntervals.has(game.code)
    }));
};
exports.getAllGames = getAllGames;
