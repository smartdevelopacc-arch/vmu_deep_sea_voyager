"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModel = void 0;
const mongoose_1 = require("mongoose");
const model_utils_1 = require("./model-utils");
const map_model_1 = require("./map.model");
const player_model_1 = require("./player.model");
const GameSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    disable: { type: Boolean, required: true, default: false },
    secret_key: { type: String, required: true },
    map: {
        type: map_model_1.MapSchema,
        required: true
    },
    runtimeState: {
        type: {
            treasures: [[Number]],
            owners: [[String]],
            traps: [{ type: Object }]
        },
        required: false
    },
    players: {
        type: [player_model_1.PlayerSchema],
        required: true
    },
    status: { type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' },
    currentTurn: { type: Number, default: 0 },
    startTime: { type: Number },
    startedAt: { type: Date },
    endedAt: { type: Date },
    scores: [{ playerId: String, score: Number }],
    history: [{ type: Object }],
    settings: {
        type: {
            enableTraps: { type: Boolean, default: true },
            maxEnergy: { type: Number },
            energyRestore: { type: Number },
            maxTurns: { type: Number },
            timeLimitMs: { type: Number }
        },
        default: {}
    }
}, {
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: model_utils_1.defaultJSONTransform
    }
});
GameSchema.virtual('leaderBoard').get(function () {
    if (!this.players || this.players.length === 0) {
        return [];
    }
    return [...this.players].sort((a, b) => b.score - a.score);
});
exports.GameModel = (0, mongoose_1.model)('Game', GameSchema);
