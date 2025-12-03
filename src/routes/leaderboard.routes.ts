import { Router } from 'express';
import { getLeaderboard } from '../controllers/leaderboard.controller';

const router = Router();
router.get('/:gameId/leaderboard', getLeaderboard);
export default router;
