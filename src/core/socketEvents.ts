import { io } from '../socket';

/**
 * Phát sự kiện hoàn thành tick - Client cần lấy lại trạng thái bản đồ
 */
export const emitTickComplete = (gameId: string, turn: number) => {
    io.to(`game:${gameId}`).emit('game:tick:complete', { 
        gameId,
        turn,
        message: 'Actions synchronized. Please fetch updated game state.'
    });
};

/**
 * Phát sự kiện cập nhật trạng thái bản đồ cho tất cả player trong game
 */
export const emitMapUpdate = (gameId: string, mapData: any) => {
    io.to(`game:${gameId}`).emit('map:update', { gameId, ...mapData });
};

/**
 * Phát sự kiện thay đổi vị trí player
 */
export const emitPlayerMove = (gameId: string, playerId: string, position: { x: number, y: number }) => {
    io.to(`game:${gameId}`).emit('player:position:changed', { gameId, playerId, position });
};

/**
 * Phát sự kiện thay đổi năng lượng player
 */
export const emitEnergyUpdate = (gameId: string, playerId: string, energy: number) => {
    io.to(`game:${gameId}`).emit('player:energy:changed', { gameId, playerId, energy });
};

/**
 * Phát sự kiện thu thập kho báu
 */
export const emitTreasureCollected = (gameId: string, playerId: string, treasure: number, position: { x: number, y: number }) => {
    io.to(`game:${gameId}`).emit('treasure:collected', { gameId, playerId, treasure, position });
};

/**
 * Phát sự kiện đặt bẫy
 */
export const emitTrapPlaced = (gameId: string, playerId: string, position: { x: number, y: number }, danger: number) => {
    io.to(`game:${gameId}`).emit('trap:placed', { gameId, playerId, position, danger });
};

/**
 * Phát sự kiện va chạm
 */
export const emitCollision = (gameId: string, attackerId: string, victimId: string, energyLoss?: number) => {
    io.to(`game:${gameId}`).emit('player:collision', { gameId, attackerId, victimId, energyLoss });
};

/**
 * Phát sự kiện thay đổi điểm số player
 */
export const emitScoreUpdate = (gameId: string, playerId: string, score: number) => {
    io.to(`game:${gameId}`).emit('player:score:changed', { gameId, playerId, score });
};

/**
 * Phát sự kiện player drop treasure tại base
 */
export const emitTreasureDropped = (gameId: string, playerId: string) => {
    io.to(`game:${gameId}`).emit('treasure:dropped', { gameId, playerId });
};

/**
 * Phát sự kiện cập nhật tất cả điểm số
 */
export const emitAllScores = (gameId: string, scores: Array<{ playerId: string, score: number }>) => {
    io.to(`game:${gameId}`).emit('score:update', { gameId, scores });
};

/**
 * Phát sự kiện bắt đầu lượt mới
 */
export const emitNewTurn = (gameId: string, turn: number) => {
    io.to(`game:${gameId}`).emit('turn:new', { gameId, turn });
};

/**
 * Phát sự kiện kết thúc trận đấu
 */
export const emitGameEnd = (gameId: string, result: any) => {
    io.to(`game:${gameId}`).emit('game:end', { gameId, result });
};
