"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultJSONTransform = void 0;
const defaultJSONTransform = (_doc, _ret) => {
    const result = _ret;
    delete result.__v;
    delete result._id;
};
exports.defaultJSONTransform = defaultJSONTransform;
