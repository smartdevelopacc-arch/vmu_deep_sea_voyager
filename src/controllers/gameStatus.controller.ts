import { Request, Response } from 'express';
import { loadGameState } from '../core/gamePersistence';
import { GameModel } from '../models/game.model';

/**
 * GET /game/:gameId/status
 * Returns minimal game status info
 */
export const getGameStatus = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    // Đọc trực tiếp từ MongoDB thay vì gọi worker
    const gameState = await loadGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      status: gameState.status,
      currentTurn: gameState.currentTurn
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /game/:gameId/state?playerId=xxx
 * Returns complete dynamic game state (for bots)
 * Combines map, players, and status in one call
 * ✅ ENHANCED: Only returns traps belonging to the requesting player
 */
export const getCompleteGameState = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { playerId } = req.query; // Get playerId from query parameter
    const gameState = await loadGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // ✅ ENHANCED: Also fetch game from DB to get complete player info with names
    const game = await GameModel.findOne({ code: gameId });

    // Convert players Map to array
    // ✅ ENHANCED: Include name/teamName/slogan for leaderboard display by enriching from DB
    const playersArray = Array.from(gameState.players.values()).map((p: any, index: number) => {
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
        slogan: dbPlayer?.slogan || p.slogan || '', // ✅ INCLUDE SLOGAN from DB player
        lastScoreTime: p.lastScoreTime || dbPlayer?.lastScoreTime // ✅ INCLUDE lastScoreTime
      };
    });

    // Only return traps belonging to the requesting player
    const trapsArray = Array.from(gameState.map.traps.values())
      .filter((t: any) => t.playerId === playerId)
      .map((t: any) => ({
        position: t.position,
        danger: t.danger,
        playerId: t.playerId,
        createdAt: t.createdAt
      }));

    res.json({
      currentTurn: gameState.currentTurn,
      status: gameState.status,
      startTime: game?.startTime, // ✅ ADDED: Game start time as timestamp from DB
      startedAt: game?.startedAt, // ✅ ADDED: Game start time as Date from DB
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
