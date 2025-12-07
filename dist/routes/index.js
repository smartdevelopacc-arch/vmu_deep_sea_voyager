"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const gameStatus_routes_1 = __importDefault(require("./gameStatus.routes"));
const map_routes_1 = __importDefault(require("./map.routes"));
const player_routes_1 = __importDefault(require("./player.routes"));
const action_routes_1 = __importDefault(require("./action.routes"));
const history_routes_1 = __importDefault(require("./history.routes"));
const leaderboard_routes_1 = __importDefault(require("./leaderboard.routes"));
const result_routes_1 = __importDefault(require("./result.routes"));
const worker_routes_1 = __importDefault(require("./worker.routes"));
const players_routes_1 = __importDefault(require("./players.routes"));
const gameSettings_routes_1 = __importDefault(require("./gameSettings.routes"));
const maps_routes_1 = __importDefault(require("./maps.routes"));
const router = (0, express_1.Router)();
// Players list (available players in system)
router.use('/players', players_routes_1.default);
// Maps list (available maps in system)
router.use('/maps', maps_routes_1.default);
// Game routes (client-facing)
router.use('/game', gameStatus_routes_1.default);
router.use('/game', map_routes_1.default);
router.use('/game', player_routes_1.default);
router.use('/game', action_routes_1.default);
router.use('/game', history_routes_1.default);
router.use('/game', leaderboard_routes_1.default);
router.use('/game', result_routes_1.default);
router.use('/game', gameSettings_routes_1.default);
// Admin routes (admin/system-facing)
router.use('/admin', worker_routes_1.default);
exports.default = router;
