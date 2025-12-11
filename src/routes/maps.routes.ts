import { Router, Request, Response } from 'express';
import { Map } from '../models/map.model';

const router = Router();

/**
 * GET /maps
 * Get all available maps (including disabled for admin)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get all maps, ordered by code
    const maps = await Map.find({}, 'code name description width height disable terrain bases treasures waves settings')
      .lean()
      .sort({ code: 1 })
      .exec();
    res.json(maps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /maps/:mapCode
 * Get specific map by code or ID
 */
router.get('/:mapCode', async (req: Request, res: Response) => {
  try {
    const { mapCode } = req.params;
    console.log('🗺️ Fetching map:', mapCode);
    
    // Build query with proper ObjectId handling
    const query: any = {};
    
    // Always try code first
    if (mapCode.length <= 50) {
      query.$or = [{ code: mapCode }];
    }
    
    // Try as ObjectId if it looks like one (24 hex chars)
    if (/^[0-9a-f]{24}$/i.test(mapCode)) {
      if (!query.$or) query.$or = [];
      query.$or.push({ _id: mapCode });
    }
    
    // If neither code nor ObjectId, just search by code
    if (!query.$or) {
      query.code = mapCode;
    }
    
    const map = await Map.findOne(query);
    
    console.log('📍 Map query result:', map ? `Found - ${map.code}` : 'Not found');

    if (!map) {
      return res.status(404).json({ error: 'Map not found', mapCode });
    }

    res.json(map);
  } catch (error: any) {
    console.error('❌ Map fetch error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /maps
 * Create a new map
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { code, name, description, width, height, disable, terrain, treasures, waves, bases } = req.body;

    // Check if map code already exists
    const existing = await Map.findOne({ code });
    if (existing) {
      return res.status(400).json({ error: `Map with code "${code}" already exists` });
    }

    // Create new map
    const newMap = new Map({
      code,
      name: name || code,
      description,
      width,
      height,
      disable: disable || false,
      terrain: terrain || Array(height).fill(0).map(() => Array(width).fill(0)),
      treasures: treasures || Array(height).fill(0).map(() => Array(width).fill(0)),
      waves: waves || Array(height).fill(0).map(() => Array(width).fill(2)),
      bases: bases || [],
      owners: Array(height).fill(null).map(() => Array(width).fill(null))
    });

    await newMap.save();
    res.status(201).json(newMap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /maps/:mapId
 * Update a map (metadata or content)
 */
router.put('/:mapId', async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;
    const { name, description, disable, terrain, treasures, waves, bases, settings } = req.body;

    const updates: any = {};
    
    // Metadata updates
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (disable !== undefined) updates.disable = disable;
    
    // Settings updates
    if (settings !== undefined) updates.settings = settings;
    
    // Content updates
    if (terrain !== undefined) updates.terrain = terrain;
    if (treasures !== undefined) updates.treasures = treasures;
    if (waves !== undefined) updates.waves = waves;
    if (bases !== undefined) updates.bases = bases;

    const map = await Map.findByIdAndUpdate(mapId, updates, { new: true });

    if (!map) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json(map);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /maps/:mapId
 * Delete a map
 */
router.delete('/:mapId', async (req: Request, res: Response) => {
  try {
    const { mapId } = req.params;

    const map = await Map.findByIdAndDelete(mapId);

    if (!map) {
      return res.status(404).json({ error: 'Map not found' });
    }

    res.json({ message: 'Map deleted successfully', map });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
