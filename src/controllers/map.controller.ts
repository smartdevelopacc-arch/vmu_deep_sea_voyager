import { Request, Response } from 'express';
import { GameModel } from '../models/game.model';

/**
 * GET /game/:gameId/config?playerId=xxx
 * Returns static game configuration that never changes
 * ✅ ENHANCED: Only returns traps belonging to the requesting player
 */
export const getGameConfig = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { playerId } = req.query; // Get playerId from query parameter
    const game = await GameModel.findOne({ code: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Static configuration only
    // ✅ ENHANCED: Include player info with bases for editor
    const basesWithPlayers = game.map.bases?.map((base: any, index: number) => ({
      position: Array.isArray(base) ? { x: base[0], y: base[1] } : base,
      playerIndex: index,
      playerCode: game.players?.[index]?.code || `player_${index}`,
      playerName: game.players?.[index]?.name || `Player ${index + 1}`
    })) || [];

    // ✅ ENHANCED: Only return traps belonging to the requesting player
    const allTraps = game.runtimeState?.traps || [];
    const playerTraps = Array.isArray(allTraps) 
      ? allTraps.filter((trap: any) => trap.playerId === playerId || trap[3] === playerId)
      : Object.values(allTraps).filter((trap: any) => trap.playerId === playerId);

    res.json({
      width: game.map.width,
      height: game.map.height,
      terrain: game.map.terrain,
      waves: game.map.waves,
      treasures: game.map.treasures,
      bases: game.map.bases,
      basesWithPlayers,
      traps: playerTraps,
      settings: {
        enableTraps: game.settings?.enableTraps ?? true,
        maxTurns: game.settings?.maxTurns,
        timeLimitMs: game.settings?.timeLimitMs
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /game/:gameId/map
 * Returns dynamic map state (treasures, owners, current turn)
 * Uses runtimeState if game is playing, otherwise initial config
 */
export const getMap = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await GameModel.findOne({ code: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Use runtimeState if game is playing
    const usesRuntimeState = game.status === 'playing' && game.runtimeState;
    const treasures = usesRuntimeState && game.runtimeState
      ? game.runtimeState.treasures 
      : game.map.treasures;
    const owners = usesRuntimeState && game.runtimeState
      ? game.runtimeState.owners 
      : game.map.owners;

    // Dynamic state only - không bao gồm thông tin bẫy (traps)
    res.json({
      currentTurn: game.currentTurn,
      treasures,
      owners
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
