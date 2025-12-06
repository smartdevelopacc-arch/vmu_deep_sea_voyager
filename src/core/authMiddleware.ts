import { Request, Response, NextFunction } from 'express';
import { Player } from '../models/player.model';

/**
 * ✅ NEW: Middleware to validate player authentication via secret
 * 
 * Requires:
 * - req.params.gameId: Game ID
 * - req.params.playerId: Player ID
 * - req.headers['player-secret']: Player secret token
 * 
 * Validates that the provided secret matches the player's stored secret in global Player collection
 */
export const validatePlayerSecret = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { playerId } = req.params;
    const playerSecret = req.headers['player-secret'] as string;

    // Check if secret is provided
    if (!playerSecret) {
      return res.status(401).json({ error: 'Missing player-secret header' });
    }

    // Find player in global Player collection
    const player = await Player.findOne({ code: playerId });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Validate secret matches
    if (player.secret !== playerSecret) {
      return res.status(403).json({ error: 'Invalid player secret' });
    }

    // Secret is valid, proceed
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
