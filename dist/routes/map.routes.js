"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const map_controller_1 = require("../controllers/map.controller");
const router = (0, express_1.Router)();
router.get('/:gameId/config', map_controller_1.getGameConfig);
router.get('/:gameId/map', map_controller_1.getMap);
exports.default = router;
