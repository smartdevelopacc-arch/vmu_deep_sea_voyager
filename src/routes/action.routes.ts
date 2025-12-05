import { Router } from 'express';
import { move, trap, rest } from '../controllers/action.controller';
import { validatePlayerSecret } from '../core/authMiddleware';

const router = Router();

// Apply validatePlayerSecret middleware to all action routes
router.post('/:gameId/player/:playerId/move', validatePlayerSecret, move);
router.post('/:gameId/player/:playerId/trap', validatePlayerSecret, trap);
router.post('/:gameId/player/:playerId/rest', validatePlayerSecret, rest);

export default router;
