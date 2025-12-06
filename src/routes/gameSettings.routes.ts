import express, { Request, Response } from 'express';
import { GameModel } from '../models/game.model';

const router = express.Router();

/**
 * GET /api/game/:gameId/settings
 * Public: Get current game settings
 */
router.get('/:gameId/settings', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    
    const game = await GameModel.findOne({ code: gameId });
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({
      settings: game.settings || {
        enableTraps: true,
        maxEnergy: 100,
        energyRestore: 10,
        maxTurns: 1200,
        timeLimitMs: 300000,
        tickIntervalMs: 500
      }
    });
  } catch (error: any) {
    console.error('Error fetching game settings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Admin-only endpoints for updating settings/map have been moved to /api/admin routes
 * See: /src/routes/worker.routes.ts for:
 * - PUT /api/admin/game/:gameId/settings
 * - PUT /api/admin/game/:gameId/map
 */

export default router;
