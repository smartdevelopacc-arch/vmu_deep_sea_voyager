import { Request, Response } from 'express';
import { GameModel } from '../models/game.model';

export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await GameModel.findOne({ code: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Sử dụng scores từ DB hoặc player scores
    let leaderboard;
    if (game.scores && game.scores.length > 0) {
      leaderboard = game.scores
        .map((s: any) => ({ playerId: s.playerId, score: s.score }))
        .sort((a: any, b: any) => b.score - a.score);
    } else {
      leaderboard = game.players
        .map((p: any) => ({ playerId: p.playerId, score: p.score || 0 }))
        .sort((a: any, b: any) => b.score - a.score);
    }

    res.json({ leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
