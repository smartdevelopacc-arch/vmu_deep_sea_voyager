import { Router } from 'express';
import { getMap, getGameConfig } from '../controllers/map.controller';

const router = Router();
router.get('/:gameId/config', getGameConfig);
router.get('/:gameId/map', getMap);
export default router;
