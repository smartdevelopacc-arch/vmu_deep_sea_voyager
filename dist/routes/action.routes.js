"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const action_controller_1 = require("../controllers/action.controller");
const authMiddleware_1 = require("../core/authMiddleware");
const rateLimitMiddleware_1 = require("../core/rateLimitMiddleware");
const router = (0, express_1.Router)();
// Apply middlewares: rate limit first, then player secret validation
router.post('/:gameId/player/:playerId/move', rateLimitMiddleware_1.rateLimitPlayerActions, authMiddleware_1.validatePlayerSecret, action_controller_1.move);
router.post('/:gameId/player/:playerId/trap', rateLimitMiddleware_1.rateLimitPlayerActions, authMiddleware_1.validatePlayerSecret, action_controller_1.trap);
router.post('/:gameId/player/:playerId/rest', rateLimitMiddleware_1.rateLimitPlayerActions, authMiddleware_1.validatePlayerSecret, action_controller_1.rest);
exports.default = router;
