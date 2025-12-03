"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitGameEnd = exports.emitNewTurn = exports.emitAllScores = exports.emitTreasureDropped = exports.emitScoreUpdate = exports.emitCollision = exports.emitTrapPlaced = exports.emitTreasureCollected = exports.emitEnergyUpdate = exports.emitPlayerMove = exports.emitMapUpdate = exports.emitTickComplete = void 0;
const socket_1 = require("../socket");
/**
 * Phát sự kiện hoàn thành tick - Client cần lấy lại trạng thái bản đồ
 */
const emitTickComplete = (gameId, turn) => {
    socket_1.io.to(`game:${gameId}`).emit('game:tick:complete', {
        gameId,
        turn,
        message: 'Actions synchronized. Please fetch updated game state.'
    });
};
exports.emitTickComplete = emitTickComplete;
/**
 * Phát sự kiện cập nhật trạng thái bản đồ cho tất cả player trong game
 */
const emitMapUpdate = (gameId, mapData) => {
    socket_1.io.to(`game:${gameId}`).emit('map:update', { gameId, ...mapData });
};
exports.emitMapUpdate = emitMapUpdate;
/**
 * Phát sự kiện thay đổi vị trí player
 */
const emitPlayerMove = (gameId, playerId, position) => {
    socket_1.io.to(`game:${gameId}`).emit('player:position:changed', { gameId, playerId, position });
};
exports.emitPlayerMove = emitPlayerMove;
/**
 * Phát sự kiện thay đổi năng lượng player
 */
const emitEnergyUpdate = (gameId, playerId, energy) => {
    socket_1.io.to(`game:${gameId}`).emit('player:energy:changed', { gameId, playerId, energy });
};
exports.emitEnergyUpdate = emitEnergyUpdate;
/**
 * Phát sự kiện thu thập kho báu
 */
const emitTreasureCollected = (gameId, playerId, treasure, position) => {
    socket_1.io.to(`game:${gameId}`).emit('treasure:collected', { gameId, playerId, treasure, position });
};
exports.emitTreasureCollected = emitTreasureCollected;
/**
 * Phát sự kiện đặt bẫy
 */
const emitTrapPlaced = (gameId, playerId, position, danger) => {
    socket_1.io.to(`game:${gameId}`).emit('trap:placed', { gameId, playerId, position, danger });
};
exports.emitTrapPlaced = emitTrapPlaced;
/**
 * Phát sự kiện va chạm
 */
const emitCollision = (gameId, attackerId, victimId, energyLoss) => {
    socket_1.io.to(`game:${gameId}`).emit('player:collision', { gameId, attackerId, victimId, energyLoss });
};
exports.emitCollision = emitCollision;
/**
 * Phát sự kiện thay đổi điểm số player
 */
const emitScoreUpdate = (gameId, playerId, score) => {
    socket_1.io.to(`game:${gameId}`).emit('player:score:changed', { gameId, playerId, score });
};
exports.emitScoreUpdate = emitScoreUpdate;
/**
 * Phát sự kiện player drop treasure tại base
 */
const emitTreasureDropped = (gameId, playerId) => {
    socket_1.io.to(`game:${gameId}`).emit('treasure:dropped', { gameId, playerId });
};
exports.emitTreasureDropped = emitTreasureDropped;
/**
 * Phát sự kiện cập nhật tất cả điểm số
 */
const emitAllScores = (gameId, scores) => {
    socket_1.io.to(`game:${gameId}`).emit('score:update', { gameId, scores });
};
exports.emitAllScores = emitAllScores;
/**
 * Phát sự kiện bắt đầu lượt mới
 */
const emitNewTurn = (gameId, turn) => {
    socket_1.io.to(`game:${gameId}`).emit('turn:new', { gameId, turn });
};
exports.emitNewTurn = emitNewTurn;
/**
 * Phát sự kiện kết thúc trận đấu
 */
const emitGameEnd = (gameId, result) => {
    socket_1.io.to(`game:${gameId}`).emit('game:end', { gameId, result });
};
exports.emitGameEnd = emitGameEnd;
