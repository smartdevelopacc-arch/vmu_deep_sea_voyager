"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const result_controller_1 = require("../controllers/result.controller");
const router = (0, express_1.Router)();
router.get('/:gameId/result', result_controller_1.getResult);
exports.default = router;
