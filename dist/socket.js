"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocket = exports.io = void 0;
const socket_io_1 = require("socket.io");
/**
 * Khởi tạo và cấu hình Socket.IO Server
 * @param httpServer Instance của HTTP Server từ Express
 */
const setupSocket = (httpServer) => {
    // Khởi tạo Socket.IO Server
    exports.io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*", // Cho phép mọi domain kết nối (chỉ dùng cho DEV)
            methods: ["GET", "POST"]
        }
    });
    // --- MIDDLEWARE XÁC THỰC (HANDSHAKE) ---
    // Middleware này chạy ngay khi client cố gắng kết nối
    exports.io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            // Từ chối kết nối nếu không có token
            return next(new Error('Authentication failed: Token is missing.'));
        }
        // --- BƯỚC MÔ PHỎNG XÁC THỰC ---
        // Trong ứng dụng thực tế: Giải mã token JWT, kiểm tra tính hợp lệ
        if (token === 'VALID_SECRET_TOKEN_123') {
            // Gán dữ liệu người dùng (giả lập) vào socket.data
            socket.data.userId = 'user-' + Math.floor(Math.random() * 100);
            console.log(`✅ Socket authenticated. UserID: ${socket.data.userId}`);
            next(); // Chấp nhận kết nối
        }
        else {
            // Từ chối kết nối nếu token không hợp lệ
            return next(new Error('Authentication failed: Invalid token.'));
        }
    });
    // ---------------------------------------
    // Xử lý kết nối cơ bản
    exports.io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        // Đăng ký player vào game để nhận events
        socket.on('register', (data) => {
            const { gameId, playerId } = data;
            socket.data.gameId = gameId;
            socket.data.playerId = playerId;
            // Join room theo gameId và playerId để nhận sự kiện broadcast
            socket.join(`game:${gameId}`);
            socket.join(`game:${gameId}:player:${playerId}`);
            console.log(`✅ Player ${playerId} joined game ${gameId}`);
            socket.emit('registered', { gameId, playerId });
        });
        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
    console.log("WebSocket/Socket.IO server setup completed.");
};
exports.setupSocket = setupSocket;
