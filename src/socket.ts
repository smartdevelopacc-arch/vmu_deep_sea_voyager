import { createServer, Server as HTTPServer } from 'http';
import { Socket, Server as SocketIOServer } from 'socket.io';

// Biến toàn cục để lưu trữ instance của Socket.IO Server
export let io: SocketIOServer;


interface CustomSocketData {
    userId: string;
    playerId?: string;
    gameId?: string;
}

/**
 * Khởi tạo và cấu hình Socket.IO Server
 * @param httpServer Instance của HTTP Server từ Express
 */
export const setupSocket = (httpServer: HTTPServer): void => {
    // Khởi tạo Socket.IO Server
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*", // Cho phép mọi domain kết nối (chỉ dùng cho DEV)
            methods: ["GET", "POST"]
        }
    });

    // --- MIDDLEWARE XÁC THỰC (HANDSHAKE) ---
    // Middleware này chạy ngay khi client cố gắng kết nối
    io.use((socket: Socket<any, any, any, CustomSocketData>, next) => {
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
        } else {
            // Từ chối kết nối nếu token không hợp lệ
            return next(new Error('Authentication failed: Invalid token.'));
        }
    });
    // ---------------------------------------

    // Xử lý kết nối cơ bản
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        
        // Đăng ký player vào game để nhận events
        socket.on('register', (data: { gameId: string, playerId: string }) => {
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