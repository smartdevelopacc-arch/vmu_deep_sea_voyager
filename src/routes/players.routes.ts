import { Router } from 'express';
import { getAvailablePlayers } from '../core/playerImporter';
import { Player } from '../models/player.model';
import crypto from 'crypto';
import { validateAdminApiKey } from '../core/adminAuthMiddleware';

const router = Router();

/**
 * Generate a 5-character random secret
 */
const generateShortSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(5);
  for (let i = 0; i < 5; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

/**
 * GET /api/players - Lấy danh sách players có sẵn trong hệ thống
 */
router.get('/', async (req, res) => {
  try {
    const players = await getAvailablePlayers();
    res.json({ players });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/players/:playerCode/regenerate-secret - Random secret mới cho player
 * Requires admin API key
 */
router.post('/:playerCode/regenerate-secret', validateAdminApiKey, async (req, res) => {
  try {
    const { playerCode } = req.params;
    
    const player = await Player.findOne({ code: playerCode });
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Generate new 5-character secret
    const newSecret = generateShortSecret();
    player.secret = newSecret;
    await player.save();

    res.json({ 
      success: true, 
      playerCode,
      secret: newSecret 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
