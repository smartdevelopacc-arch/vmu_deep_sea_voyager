import { Request, Response } from 'express';
import { GameModel } from '../models/game.model';

export const getHistory = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await GameModel.findOne({ code: gameId });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Trả về history từ DB
    res.json({ 
      currentTurn: game.currentTurn,
      history: game.history || [] 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
