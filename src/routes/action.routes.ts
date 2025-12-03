import { Router } from 'express';
import { move, trap, rest, pickTreasure, dropTreasure } from '../controllers/action.controller';

const router = Router();
router.post('/:gameId/player/:playerId/move', move);
router.post('/:gameId/player/:playerId/trap', trap);
router.post('/:gameId/player/:playerId/rest', rest);
router.post('/:gameId/player/:playerId/pick-treasure', pickTreasure);
router.post('/:gameId/player/:playerId/drop-treasure', dropTreasure);
export default router;
