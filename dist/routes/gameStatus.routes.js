"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gameStatus_controller_1 = require("../controllers/gameStatus.controller");
const router = (0, express_1.Router)();
router.get('/:gameId/status', gameStatus_controller_1.getGameStatus);
router.get('/:gameId/state', gameStatus_controller_1.getCompleteGameState);
exports.default = router;
