"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const path_1 = __importDefault(require("path"));
const db_1 = require("./core/db");
const socket_1 = require("./socket");
const routes_1 = __importDefault(require("./routes"));
const playerImporter_1 = require("./core/playerImporter");
const mapImporter_1 = require("./core/mapImporter");
const rateLimitMiddleware_1 = require("./core/rateLimitMiddleware");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Serve dashboard static files (production)
const dashboardPath = path_1.default.join(__dirname, '../dashboard/dist');
app.use('/dashboard', express_1.default.static(dashboardPath));
// SPA fallback for dashboard routes - moved after API routes to avoid conflicts
// Routes - tất cả routes được quản lý trong /routes
app.use('/api', routes_1.default);
// Health check tổng thể
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Deep Sea Voyager Server',
        components: {
            api: 'running',
            worker: 'running',
            socket: 'running'
        }
    });
});
// SPA fallback - catch all dashboard routes (must be after all API routes)
app.use('/dashboard', (req, res) => {
    res.sendFile(path_1.default.join(dashboardPath, 'index.html'));
});
// Create HTTP server
const httpServer = (0, http_1.createServer)(app);
// Setup Socket.IO - Phải setup trước khi start server
(0, socket_1.setupSocket)(httpServer);
// Start server
const startServer = async () => {
    try {
        await (0, db_1.connectDB)();
        // Import players từ thư mục assets/players/
        await (0, playerImporter_1.importPlayers)();
        await (0, mapImporter_1.importMaps)({ skipDuplicates: true });
        // Start rate limit cleanup
        (0, rateLimitMiddleware_1.startRateLimitCleanup)();
        httpServer.listen(PORT, () => {
            console.log(`🚀 API Server running on port ${PORT}`);
            console.log(`📡 WebSocket server ready`);
            console.log(`🎮 Game Loop Worker integrated`);
            console.log(`💡 Worker và Server chia sẻ Socket.IO instance`);
            console.log(`🔒 Rate limit: ${process.env.PLAYER_ACTIONS_PER_SECOND || 5} actions/second per player`);
            console.log(`\n📋 API Routes:`);
            console.log(`   - Client API: http://localhost:${PORT}/api/game/*`);
        });
        // Heartbeat
        setInterval(() => {
            console.log(`💓 Server heartbeat - All systems operational`);
        }, 30000);
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};
startServer();
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down API server...');
    httpServer.close(() => {
        console.log('API server closed');
        process.exit(0);
    });
});
