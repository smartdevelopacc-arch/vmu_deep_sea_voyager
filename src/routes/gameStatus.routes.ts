import { Router } from 'express';
import { getGameStatus, getCompleteGameState } from '../controllers/gameStatus.controller';

const router = Router();
router.get('/:gameId/status', getGameStatus);
router.get('/:gameId/state', getCompleteGameState);
export default router;
