import { Router } from 'express';
import gameStatusRoutes from './gameStatus.routes';
import mapRoutes from './map.routes';
import playerRoutes from './player.routes';
import actionRoutes from './action.routes';
import historyRoutes from './history.routes';
import leaderboardRoutes from './leaderboard.routes';
import resultRoutes from './result.routes';
import workerRoutes from './worker.routes';
import playersRoutes from './players.routes';
import gameSettingsRoutes from './gameSettings.routes';
import mapsRoutes from './maps.routes';

const router = Router();

// Players list (available players in system)
router.use('/players', playersRoutes);

// Maps list (available maps in system)
router.use('/maps', mapsRoutes);

// Game routes (client-facing)
router.use('/game', gameStatusRoutes);
router.use('/game', mapRoutes);
router.use('/game', playerRoutes);
router.use('/game', actionRoutes);
router.use('/game', historyRoutes);
router.use('/game', leaderboardRoutes);
router.use('/game', resultRoutes);
router.use('/game', gameSettingsRoutes);

// Admin routes (admin/system-facing)
router.use('/admin', workerRoutes);

export default router;
