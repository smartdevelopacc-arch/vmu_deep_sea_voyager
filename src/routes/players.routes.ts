import { Router } from 'express';
import { getAvailablePlayers } from '../core/playerImporter';

const router = Router();

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

export default router;
