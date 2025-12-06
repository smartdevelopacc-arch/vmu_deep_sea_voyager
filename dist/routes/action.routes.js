"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const action_controller_1 = require("../controllers/action.controller");
const authMiddleware_1 = require("../core/authMiddleware");
const router = (0, express_1.Router)();
// Apply validatePlayerSecret middleware to all action routes
router.post('/:gameId/player/:playerId/move', authMiddleware_1.validatePlayerSecret, action_controller_1.move);
router.post('/:gameId/player/:playerId/trap', authMiddleware_1.validatePlayerSecret, action_controller_1.trap);
router.post('/:gameId/player/:playerId/rest', authMiddleware_1.validatePlayerSecret, action_controller_1.rest);
exports.default = router;
