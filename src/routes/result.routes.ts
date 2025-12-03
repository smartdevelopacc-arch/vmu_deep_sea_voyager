import { Router } from 'express';
import { getResult } from '../controllers/result.controller';

const router = Router();
router.get('/:gameId/result', getResult);
export default router;
