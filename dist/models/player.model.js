"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = exports.PlayerSchema = void 0;
const mongoose_1 = require("mongoose");
const model_utils_1 = require("./model-utils");
exports.PlayerSchema = new mongoose_1.Schema({
    code: { type: String, required: true }, // Removed unique: true for embedded use in games
    name: { type: String, required: true },
    logo: { type: String, required: false },
    slogan: { type: String, required: false },
    score: { type: Number, required: false, default: 0 },
    energy: { type: Number, required: false, default: 100 },
    position: {
        x: { type: Number, required: false },
        y: { type: Number, required: false }
    },
    carriedTreasure: { type: Number, required: false },
    trapCount: { type: Number, required: false, default: 0 },
    moveHistory: [{ turn: Number, position: { x: Number, y: Number } }]
}, {
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: model_utils_1.defaultJSONTransform
    }
});
exports.Player = (0, mongoose_1.model)('Player', exports.PlayerSchema);
