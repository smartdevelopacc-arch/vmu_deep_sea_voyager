import { Router } from 'express';
import { getHistory } from '../controllers/history.controller';

const router = Router();
router.get('/:gameId/history', getHistory);
export default router;
