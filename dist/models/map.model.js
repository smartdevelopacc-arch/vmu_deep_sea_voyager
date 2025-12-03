"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Map = exports.MapSchema = void 0;
const mongoose_1 = require("mongoose");
const model_utils_1 = require("./model-utils");
exports.MapSchema = new mongoose_1.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    width: { type: Number, required: true, default: 50 },
    height: { type: Number, required: true, default: 50 },
    disable: { type: Boolean, required: true, default: false },
    terrain: {
        type: [[Number]],
        required: true,
    },
    traps: {
        type: [[Number]],
        required: true,
    },
    treasures: {
        type: [[Number]],
        required: true,
    },
    bases: {
        type: [[Number]],
        required: true,
    },
    waves: {
        type: [[Number]],
        required: false,
    },
    owners: {
        type: mongoose_1.Schema.Types.Mixed, // Support both number[][] and string[][]
        required: false,
    },
    history: [{ type: Object }]
}, {
    versionKey: false,
    toJSON: {
        virtuals: true,
        transform: model_utils_1.defaultJSONTransform
    }
});
exports.MapSchema.virtual('layout').get(function () {
    const ret = Array.from({ length: this.height }, () => new Array(this.width).fill(0));
    // Outer loop for ROWS (j or 'r' < height)
    for (let r = 0; r < this.height; r++) {
        // Inner loop for COLUMNS (i or 'c' < width)
        for (let c = 0; c < this.width; c++) {
            if (this.terrain[r][c] < 0)
                ret[r][c] = -1;
            else
                ret[r][c] = this.terrain[r][c]
                    + this.treasures[r][c];
        }
    }
    return ret;
});
exports.Map = (0, mongoose_1.model)('Map', exports.MapSchema);
