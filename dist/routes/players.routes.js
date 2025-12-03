"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const playerImporter_1 = require("../core/playerImporter");
const router = (0, express_1.Router)();
/**
 * GET /api/players - Lấy danh sách players có sẵn trong hệ thống
 */
router.get('/', async (req, res) => {
    try {
        const players = await (0, playerImporter_1.getAvailablePlayers)();
        res.json({ players });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
