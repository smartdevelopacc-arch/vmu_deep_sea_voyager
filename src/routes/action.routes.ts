import { Router } from 'express';
import { move, trap, rest } from '../controllers/action.controller';
import { validatePlayerSecret } from '../core/authMiddleware';
import { rateLimitPlayerActions } from '../core/rateLimitMiddleware';

const router = Router();

// Apply middlewares: rate limit first, then player secret validation
router.post('/:gameId/player/:playerId/move', rateLimitPlayerActions, validatePlayerSecret, move);
router.post('/:gameId/player/:playerId/trap', rateLimitPlayerActions, validatePlayerSecret, trap);
router.post('/:gameId/player/:playerId/rest', rateLimitPlayerActions, validatePlayerSecret, rest);

export default router;
