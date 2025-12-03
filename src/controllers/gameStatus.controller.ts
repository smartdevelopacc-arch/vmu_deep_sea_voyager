import { Request, Response } from 'express';
import { loadGameState } from '../core/gamePersistence';

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
 * GET /game/:gameId/state
 * Returns complete dynamic game state (for bots)
 * Combines map, players, and status in one call
 */
export const getCompleteGameState = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const gameState = await loadGameState(gameId);

    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Convert players Map to array
    const playersArray = Array.from(gameState.players.values()).map((p: any) => ({
      playerId: p.playerId,
      code: p.code,
      position: p.position,
      energy: p.energy,
      score: p.score,
      carriedTreasure: p.carriedTreasure || 0
    }));

    res.json({
      currentTurn: gameState.currentTurn,
      status: gameState.status,
      treasures: gameState.map.treasures,
      owners: gameState.map.owners,
      players: playersArray
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
