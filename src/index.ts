import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { connectDB } from './core/db';
import { setupSocket } from './socket';
import routes from './routes';
import { importPlayers } from './core/playerImporter';
import { importMaps } from './core/mapImporter';
import { startRateLimitCleanup } from './core/rateLimitMiddleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve dashboard static files (production)
const dashboardPath = path.join(__dirname, '../dashboard/dist');
app.use('/dashboard', express.static(dashboardPath));
// SPA fallback for dashboard routes - moved after API routes to avoid conflicts

// Routes - tất cả routes được quản lý trong /routes
app.use('/api', routes);

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
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Create HTTP server
const httpServer = createServer(app);

// Setup Socket.IO - Phải setup trước khi start server
setupSocket(httpServer);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    // Import players từ thư mục assets/players/
    await importPlayers();
    await importMaps({ skipDuplicates: true});
    
    // Start rate limit cleanup
    startRateLimitCleanup();
    
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

  } catch (error) {
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
