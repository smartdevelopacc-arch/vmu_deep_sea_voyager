import { Router, Request, Response } from 'express';
import { Map } from '../models/map.model';

const router = Router();

/**
 * GET /maps
 * Get all available maps
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const maps = await Map.find({ disable: false }, 'code name width height')
      .lean()
      .exec();
    res.json(maps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /maps/:mapCode
 * Get specific map by code
 */
router.get('/:mapCode', async (req: Request, res: Response) => {
  try {
    const { mapCode } = req.params;
    const map = await Map.findOne({ code: mapCode });

    if (!map) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json(map);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
