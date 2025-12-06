"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerActionModel = void 0;
const mongoose_1 = require("mongoose");
const model_utils_1 = require("./model-utils");
const PlayerActionSchema = new mongoose_1.Schema({
    gameId: { type: String, required: true, index: true },
    playerId: { type: String, required: true, index: true },
    actionType: {
        type: String,
        required: true,
        enum: ['move', 'trap', 'rest']
    },
    data: { type: mongoose_1.Schema.Types.Mixed },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'processed', 'failed'],
        default: 'pending',
        index: true
    },
    timestamp: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date },
    error: { type: String }
}, {
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: model_utils_1.defaultJSONTransform
    }
});
// Compound index cho query hiệu quả
PlayerActionSchema.index({ gameId: 1, status: 1, timestamp: 1 });
exports.PlayerActionModel = (0, mongoose_1.model)('PlayerAction', PlayerActionSchema);
