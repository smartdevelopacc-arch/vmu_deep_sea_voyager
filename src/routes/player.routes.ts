import { Router } from 'express';
import { getPlayers } from '../controllers/player.controller';

const router = Router();
router.get('/:gameId/players', getPlayers);
export default router;
