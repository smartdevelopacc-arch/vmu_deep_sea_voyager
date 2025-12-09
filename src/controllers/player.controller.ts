import { Request, Response } from 'express';
import { GameModel } from '../models/game.model';

export const getPlayers = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await GameModel.findOne({ code: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const players = game.players.map((p: any) => ({
      playerId: p.code || p.playerId, // DB schema uses 'code' field
      code: p.code, // ✅ INCLUDE CODE for matching in dashboard
      name: p.name, // ✅ INCLUDE NAME
      logo: p.logo, // ✅ INCLUDE LOGO
      slogan: p.slogan, // ✅ INCLUDE SLOGAN
      position: p.position,
      energy: p.energy,
      carriedTreasure: p.carriedTreasure,
      trapCount: p.trapCount,
      score: p.score
    }));

    res.json({ players });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
