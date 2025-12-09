import { Router, Request, Response } from 'express';
import { 
  initializeGame, 
  startGame, 
  stopGame, 
  getGameState, 
  getAllGames 
} from '../core/gameLoop';
import { GameModel } from '../models/game.model';
import { validateAdminApiKey } from '../core/adminAuthMiddleware';

const router = Router();

// Apply API key validation to ALL admin routes
router.use(validateAdminApiKey);

/**
 * Generate random terrain: -1 cho đảo, 0 cho biển
 * Tỷ lệ đảo: ~15%
 * ✅ Rule: Đảo không được đặt trên base
 */
function generateRandomTerrain(width: number, height: number, bases?: number[][]): number[][] {
  // Convert bases to Set for faster lookup
  const baseSet = new Set<string>();
  if (bases) {
    bases.forEach(base => {
      const x = Array.isArray(base) ? base[0] : (base as any).x;
      const y = Array.isArray(base) ? base[1] : (base as any).y;
      baseSet.add(`${x},${y}`);
    });
  }

  const terrain: number[][] = [];
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // ✅ Check if this position is a base
      const isBase = baseSet.has(`${x},${y}`);
      
      if (isBase) {
        // Base positions must be sea (0), never island (-1)
        row.push(0);
      } else {
        // 15% chance là đảo (-1), còn lại là biển (0)
        row.push(Math.random() < 0.15 ? -1 : 0);
      }
    }
    terrain.push(row);
  }
  return terrain;
}

/**
 * Generate random waves: giá trị từ 0 đến 5
 * Waves giảm dần từ tâm ra ngoài (tâm = 5 mạnh nhất, rìa = 0 nhẹ nhất)
 */
function generateRandomWaves(width: number, height: number): number[][] {
  const waves: number[][] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  
  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      // Tính khoảng cách từ tâm
      const distX = x - centerX;
      const distY = y - centerY;
      const distance = Math.sqrt(distX * distX + distY * distY);
      
      // Normalize về 0-1, đảo ngược để tâm = 1, rìa = 0
      const normalized = 1 - (distance / maxDistance);
      const waveValue = Math.floor(normalized * 5);
      
      // Đảm bảo giá trị trong khoảng 0-5
      row.push(Math.min(5, Math.max(0, waveValue)));
    }
    waves.push(row);
  }
  return waves;
}

/**
 * Generate treasures: giá trị cao hơn ở gần tâm, số lượng = 20% * N (với map NxN)
 * Giá trị: 100, 80, 50, 30, 10 (càng gần tâm càng cao)
 * ✅ Rule: Kho báu không được đặt trên đảo (terrain=-1)
 */
function generateRandomTreasures(width: number, height: number, terrain?: number[][]): number[][] {
  const treasures: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));
  
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  
  // Số lượng kho báu = 20% * N (lấy giá trị nhỏ hơn giữa width và height)
  const N = Math.min(width, height);
  const treasureCount = Math.floor(N * 0.2);
  
  console.log(`[Treasure Gen] Map ${width}x${height}, N=${N}, treasureCount=${treasureCount}`);
  
  // Bán kính tâm map để đặt treasure (khu vực sóng cao)
  const treasureRadius = maxDistance * 0.4; // 40% bán kính từ tâm
  
  let placed = 0;
  const maxAttempts = treasureCount * 100;
  let attempts = 0;
  
  while (placed < treasureCount && attempts < maxAttempts) {
    attempts++;
    
    // Random vị trí trong vùng tâm
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * treasureRadius;
    
    const x = Math.floor(centerX + distance * Math.cos(angle));
    const y = Math.floor(centerY + distance * Math.sin(angle));
    
    // Kiểm tra vị trí hợp lệ
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (treasures[y][x] > 0) continue;
    
    // ✅ Check if this position is an island (terrain=-1)
    if (terrain && terrain[y]?.[x] === -1) continue;
    
    // Tính khoảng cách thực tế từ tâm
    const distX = x - centerX;
    const distY = y - centerY;
    const actualDistance = Math.sqrt(distX * distX + distY * distY);
    const normalized = 1 - (actualDistance / treasureRadius); // 0 = rìa vùng, 1 = tâm
    
    // Xác định giá trị treasure dựa trên khoảng cách
    let value = 0;
    if (normalized > 0.8) {
      value = 100; // Rất gần tâm
    } else if (normalized > 0.6) {
      value = 80;
    } else if (normalized > 0.4) {
      value = 50;
    } else if (normalized > 0.2) {
      value = 30;
    } else {
      value = 10;
    }
    
    treasures[y][x] = value;
    placed++;
  }
  
  console.log(`[Treasure Gen] ✅ Placed ${placed}/${treasureCount} treasures`);
  return treasures;
}

/**
 * GET /worker/health
 * Health check cho worker
 */
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Game Loop Worker' });
});

/**
 * GET /worker/games
 * Lấy danh sách tất cả games đang chạy
 */
router.get('/games', async (req, res) => {
  try {
    const games = await getAllGames();
    res.json({ games });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /worker/game/:gameId/loop-status
 * Trả về trạng thái loop (có interval đang chạy hay không)
 */
router.get('/game/:gameId/loop-status', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await GameModel.findOne({ code: gameId }).select('status currentTurn').lean();
    if (!game) return res.status(404).json({ error: 'Game not found' });
    // activeGameIntervals nằm bên trong gameLoop module - import gián tiếp qua getAllGames không expose.
    // Tạm dùng heuristic: status === 'playing' && currentTurn >= 0
    const isPlaying = game.status === 'playing';
    res.json({ gameId, status: game.status, currentTurn: game.currentTurn || 0, loopActive: isPlaying });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /worker/game/init
 * Khởi tạo game mới
 * Body: { gameId, mapData, players }
 */
router.post('/game/init', async (req, res) => {
  try {
    const { gameId, mapData, players } = req.body;
    
    if (!gameId || !mapData || !players) {
      return res.status(400).json({ 
        error: 'Missing required fields: gameId, mapData, players' 
      });
    }
    
    // Auto-generate terrain nếu không có
    let processedMapData = { ...mapData };
    
    if (!processedMapData.terrain || processedMapData.terrain.length === 0) {
      const { width, height } = processedMapData;
      // ✅ Pass bases to avoid placing islands on base positions
      processedMapData.terrain = generateRandomTerrain(width, height, processedMapData.bases);
    }
    
    // Auto-generate obstacles từ terrain (để backward compatible)
    if (!processedMapData.obstacles || processedMapData.obstacles.length === 0) {
      processedMapData.obstacles = processedMapData.terrain;
    }
    
    // Auto-generate waves nếu không có (0-5)
    if (!processedMapData.waves || processedMapData.waves.length === 0) {
      const { width, height } = processedMapData;
      processedMapData.waves = generateRandomWaves(width, height);
    }
    
    // Auto-generate treasures nếu không có (20% kích thước, giá trị cao ở tâm)
    if (!processedMapData.treasures || processedMapData.treasures.length === 0) {
      const { width, height } = processedMapData;
      // ✅ Pass terrain to avoid placing treasures on islands
      processedMapData.treasures = generateRandomTreasures(width, height, processedMapData.terrain);
    }
    
    // Auto-generate bases nếu không có (2 bases ở góc)
    if (!processedMapData.bases || processedMapData.bases.length === 0) {
      const { width, height } = processedMapData;
      processedMapData.bases = [
        [0, 0],
        [width - 1, height - 1]
      ];
    }
    
    // Convert player format: {code, name} -> {playerId}
    // Dashboard sends {playerId, code, name, logo, teamId, position, energy}
    // API test sends {code, name}
    const processedPlayers = players.map((p: any) => ({
      playerId: p.playerId || p.code, // Support both formats
      code: p.code || p.playerId,
      name: p.name, // Include player name from dashboard
      logo: p.logo, // Include player logo from dashboard
      teamId: p.teamId || p.code,
      position: p.position,
      energy: p.energy || 100
    }));
    
    await initializeGame(gameId, processedMapData, processedPlayers);
    res.json({ success: true, gameId });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /worker/game/:gameId/start
 * Bắt đầu game loop
 */
router.post('/game/:gameId/start', async (req, res) => {
  try {
    const { gameId } = req.params;
    await startGame(gameId);
    res.json({ success: true, gameId, message: 'Game loop started' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /admin/game/:gameId/stop
 * Stop game loop (game vẫn tồn tại, chỉ dừng chạy)
 */
router.post('/game/:gameId/stop', async (req, res) => {
  try {
    const { gameId } = req.params;
    await stopGame(gameId);
    res.json({ success: true, gameId, message: 'Game loop stopped' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /admin/game/:gameId
 * Delete game completely from database
 */
router.delete('/game/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Stop game first if it's running
    try {
      await stopGame(gameId);
    } catch (err) {
      // Ignore if already stopped
    }
    
    // Delete from database
    const game = await GameModel.findOneAndDelete({ code: gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({ success: true, gameId, message: 'Game deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /admin/game/:gameId/reset
 * Reset game state về initial map config (treasures, owners, traps)
 * Chỉ có thể reset khi game đang ở trạng thái 'waiting' (không chạy)
 */
router.post('/game/:gameId/reset', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Tìm game
    const game = await GameModel.findOne({ code: gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Chỉ cho phép reset khi game không chạy
    if (game.status === 'playing') {
      return res.status(400).json({ error: 'Cannot reset while game is playing. Stop the game first.' });
    }

    // Reset về initial state
    game.status = 'waiting';
    game.currentTurn = 0;
    game.startTime = undefined;
    game.startedAt = undefined;
    game.endedAt = undefined;
    game.runtimeState = undefined; // Xóa runtime state
    
    // Reset players về base positions
    game.players.forEach((player: any, index: number) => {
      const basePosition = game.map.bases[index];
      if (basePosition) {
        player.position = Array.isArray(basePosition) 
          ? { x: basePosition[0], y: basePosition[1] }
          : basePosition;
      }
      player.energy = 100;
      player.score = 0;
      player.carriedTreasure = 0;
    });

    await game.save();
    
    console.log(`🔄 Game ${gameId} reset to initial state`);
    res.json({ 
      success: true, 
      gameId, 
      message: 'Game reset to initial state',
      status: game.status,
      currentTurn: game.currentTurn
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /worker/game/:gameId/state
 * Lấy trạng thái game (debug)
 */
router.get('/game/:gameId/state', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Lấy trực tiếp từ DB thay vì qua memory
    const game = await GameModel.findOne({ code: gameId }).lean();
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    console.log('[DEBUG] Game found:', game.code);
    console.log('[DEBUG] Players in DB:', game.players?.length || 0);
    if (game.players && game.players.length > 0) {
      console.log('[DEBUG] First player:', JSON.stringify(game.players[0], null, 2));
    }
    
    // Convert traps từ runtimeState hoặc map
    const usesRuntimeState = game.status === 'playing' && game.runtimeState;
    let traps: any = {};
    const trapSource = (usesRuntimeState && game.runtimeState) ? game.runtimeState.traps : game.map?.traps;

    // Track trap count by owner to keep UI in sync with actual board state
    const trapCountByPlayer = new Map<string, number>();
    
    if (trapSource && Array.isArray(trapSource)) {
      // Traps là array của [x, y, danger, playerId] hoặc object
      trapSource.forEach((trap: any) => {
        if (Array.isArray(trap)) {
          // Format: [x, y, danger, playerId]
          const key = `${trap[0]},${trap[1]}`;
          traps[key] = {
            position: { x: trap[0], y: trap[1] },
            danger: trap[2] || 1,
            playerId: trap[3] || 'unknown'
          };
          const owner = trap[3];
          if (owner) {
            trapCountByPlayer.set(owner, (trapCountByPlayer.get(owner) || 0) + 1);
          }
        } else if (trap.position) {
          // Format: { position: {x, y}, danger, playerId }
          const key = `${trap.position.x},${trap.position.y}`;
          traps[key] = trap;
          if (trap.playerId) {
            trapCountByPlayer.set(trap.playerId, (trapCountByPlayer.get(trap.playerId) || 0) + 1);
          }
        }
      });
    } else if (trapSource) {
      // Traps đã là object/Map
      traps = trapSource;
    }
    
    console.log('[DEBUG] Traps count:', Object.keys(traps).length);
    console.log('[DEBUG] Using runtime state:', usesRuntimeState);
    
    // Convert bases
    const bases = (game.map?.bases || []).map((base: any) => {
      if (Array.isArray(base)) {
        return { x: base[0], y: base[1] };
      }
      return base;
    });
    
    // Use runtimeState if game is playing
    const treasures = (usesRuntimeState && game.runtimeState) ? game.runtimeState.treasures : (game.map?.treasures || []);
    const owners = (usesRuntimeState && game.runtimeState) ? game.runtimeState.owners : (game.map?.owners || []);
    
    const gameState = {
      gameId: game.code,
      status: game.status,
      currentTurn: game.currentTurn || 0,
      players: (game.players || []).map((p: any) => ({
        code: p.code || p.playerId,
        playerId: p.code || p.playerId,
        name: p.name,
        logo: p.logo, // ✅ INCLUDE LOGO
        slogan: p.slogan, // ✅ INCLUDE SLOGAN
        position: p.position,
        energy: p.energy,
        score: p.score || 0,
        carriedTreasure: p.carriedTreasure,
        trapCount: trapCountByPlayer.get(p.code || p.playerId) || p.trapCount || 0
      })),
      map: {
        width: game.map?.width || 0,
        height: game.map?.height || 0,
        terrain: game.map?.terrain || [],
        obstacles: game.map?.terrain || [],
        waves: game.map?.waves || [],
        treasures,
        traps,
        bases,
        owners
      }
    };
    
    console.log('[DEBUG] Sending response with players:', gameState.players.length);
    
    res.json({ gameState });
  } catch (error: any) {
    console.error('[ERROR] /game/:gameId/state:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/game/:gameId/settings
 * Admin-only: Update game settings (only when game hasn't started)
 */
router.put('/game/:gameId/settings', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { enableTraps, maxEnergy, energyRestore, maxTurns, timeLimitMs, tickIntervalMs } = req.body;

    const game = await GameModel.findOne({ code: gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only allow update when game hasn't started
    if (game.status === 'playing') {
      return res.status(400).json({ error: 'Cannot update settings while game is running' });
    }

    // Validate tickIntervalMs if provided
    if (tickIntervalMs !== undefined && tickIntervalMs < 500) {
      return res.status(400).json({ error: 'Tick interval must be at least 500ms' });
    }

    // Update settings
    game.settings = {
      enableTraps: enableTraps ?? game.settings?.enableTraps ?? true,
      maxEnergy: maxEnergy ?? game.settings?.maxEnergy ?? 100,
      energyRestore: energyRestore ?? game.settings?.energyRestore ?? 10,
      maxTurns: maxTurns ?? game.settings?.maxTurns ?? 1200,
      timeLimitMs: timeLimitMs ?? game.settings?.timeLimitMs ?? 300000,
      tickIntervalMs: tickIntervalMs ?? game.settings?.tickIntervalMs ?? 500
    };

    await game.save();

    res.json({
      success: true,
      settings: game.settings
    });
  } catch (error: any) {
    console.error('Error updating game settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/game/:gameId/map
 * Admin-only: Update game map (only when game hasn't started)
 */
router.put('/game/:gameId/map', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { terrain, waves, treasures, bases, traps } = req.body;

    const game = await GameModel.findOne({ code: gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Only allow update when game hasn't started
    if (game.status === 'playing') {
      return res.status(400).json({ error: 'Cannot update map while game is running' });
    }

    // Update map data
    if (terrain) game.map.terrain = terrain;
    if (waves) game.map.waves = waves;
    if (treasures) game.map.treasures = treasures;
    if (bases) game.map.bases = bases;
    
    // Update runtime state traps if provided (for pre-placed traps)
    if (traps !== undefined) {
      if (!game.runtimeState) {
        game.runtimeState = {
          treasures: game.map.treasures || [],
          owners: [],
          traps: []
        }
      }
      game.runtimeState.traps = traps
    }

    await game.save();

    res.json({
      success: true,
      message: 'Map updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating game map:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
