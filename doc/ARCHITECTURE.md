# Kiến trúc hệ thống Deep Sea Voyager

## Tổng quan 3 module

Hệ thống được chia thành 3 module độc lập với trách nhiệm rõ ràng:

### 1. **SERVER** (Port 3000)
**Chức năng:** Cung cấp REST API cho player tương tác với game

**Endpoints:**
- `GET /api/game/:gameId/status` - Lấy trạng thái game (đọc từ MongoDB)
- `GET /api/game/:gameId/map` - Lấy trạng thái bản đồ (đọc từ MongoDB)
- `GET /api/game/:gameId/players` - Lấy danh sách players (đọc từ MongoDB)
- `POST /api/game/:gameId/player/:playerId/move` - Di chuyển (ghi vào PlayerActionModel)
- `POST /api/game/:gameId/player/:playerId/trap` - Đặt bẫy (ghi vào PlayerActionModel)
- `POST /api/game/:gameId/player/:playerId/rest` - Nghỉ ngơi (ghi vào PlayerActionModel)
- `POST /api/game/:gameId/player/:playerId/pick-treasure` - Thu thập kho báu (ghi vào PlayerActionModel)
- `POST /api/game/:gameId/player/:playerId/drop-treasure` - Dỡ kho báu (ghi vào PlayerActionModel)
- `GET /api/game/:gameId/history` - Lịch sử trận đấu (đọc từ MongoDB)
- `GET /api/game/:gameId/leaderboard` - Bảng xếp hạng (đọc từ MongoDB)
- `GET /api/game/:gameId/result` - Kết quả cuối cùng (đọc từ MongoDB)

**Cơ chế hoạt động - Giao tiếp qua MongoDB:**
- **Nhận actions từ players:** Ghi vào collection `PlayerActions` với status='pending'
- **Đọc game state:** Đọc trực tiếp từ collection `Games` (KHÔNG gọi Worker)
- **Trả về response:** Ngay lập tức sau khi ghi DB
- **Xử lý thực tế:** Worker poll actions từ DB, xử lý, và cập nhật `Games` collection

**Flow ghi action:**
```
Client → POST /api/.../move → Server validates → PlayerActionModel.create({status:'pending'}) → Response 200
```

**Flow đọc state:**
```
Client → GET /api/.../status → GameModel.findOne() → Response với data từ DB
```

---

### 2. **SOCKET** (WebSocket on Port 3000)
**Chức năng:** Broadcast events real-time đến clients - **CHỈ EMIT, KHÔNG NHẬN**

**Events được emit:**

#### Tick & Game Status
- `game:tick:complete` - Báo hiệu 1 tick đã hoàn thành, client cần fetch lại state
  ```json
  { "turn": 123 }
  ```

- `turn:new` - Bắt đầu lượt mới
  ```json
  { "turn": 124 }
  ```

- `game:end` - Trận đấu kết thúc
  ```json
  { "result": {...} }
  ```

#### Player State Changes
- `player:position:changed` - Vị trí player thay đổi
  ```json
  { "playerId": "player1", "position": { "x": 5, "y": 10 } }
  ```

- `player:energy:changed` - Năng lượng thay đổi
  ```json
  { "playerId": "player1", "energy": 75 }
  ```

- `player:score:changed` - Điểm số thay đổi
  ```json
  { "playerId": "player1", "score": 150 }
  ```

#### Collision & Combat
- `player:collision` - Va chạm xảy ra
  ```json
  { "attackerId": "player1", "victimId": "player2", "energyLoss": 20 }
  ```

#### Map Events
- `map:update` - Cập nhật bản đồ (nếu cần)
  ```json
  { "treasures": [...], "traps": [...] }
  ```

- `treasure:collected` - Kho báu được thu thập
  ```json
  { "playerId": "player1", "treasure": 50 }
  ```

- `trap:placed` - Bẫy được đặt
  ```json
  { "playerId": "player1", "position": {...}, "danger": 30 }
  ```

**Client workflow:**
1. Kết nối WebSocket với token authentication
2. Emit `register` event: `{ gameId, playerId }`
3. Lắng nghe các events trên để cập nhật UI
4. Khi nhận `game:tick:complete` → Gọi REST API lấy lại trạng thái đầy đủ

**Lưu ý quan trọng:**
- Socket **KHÔNG** nhận player actions (move, trap, rest)
- Player phải gửi actions qua REST API
- Socket chỉ là kênh broadcast 1 chiều từ server → clients

---

### 3. **WORKER** (Port 3001)
**Chức năng:** Quản lý game lifecycle và xử lý game loop - **STATELESS** architecture

**Endpoints (Internal - chỉ Admin/System dùng):**
- `GET /health` - Health check
- `POST /game/init` - Khởi tạo game mới (ghi vào MongoDB)
- `POST /game/:gameId/start` - Bắt đầu game loop (chỉ track intervalId)
- `POST /game/:gameId/stop` - Dừng game
- `GET /game/:gameId/state` - Lấy state hiện tại (đọc từ MongoDB)
- `GET /games` - Lấy danh sách games đang chạy (đọc từ MongoDB)

**Stateless Architecture:**
- Worker **KHÔNG** lưu game state trong memory
- Chỉ track `activeGameIntervals` Map để biết game nào đang có interval chạy
- Mỗi tick: Load từ DB → Process → Save lại DB

**Game Loop Logic (mỗi tick):**
1. `loadGameState(gameId)` - Load state từ MongoDB
2. `pollActionsFromDB(gameId)` - Đọc actions có status='pending'
3. Process actions theo thứ tự FIFO
4. Tính toán va chạm, cập nhật energy, scores
5. `saveGameState(gameState)` - Lưu state vào MongoDB
6. Update actions status: 'pending' → 'processed'
7. Emit events qua Socket (nếu có socket instance)
8. Kiểm tra điều kiện kết thúc game

**Action Processing Order:**
1. `move` - Di chuyển
2. `trap` - Đặt bẫy
3. `rest` - Nghỉ ngơi (+10 energy)
4. `pick-treasure` - Thu thập
5. `drop-treasure` - Dỡ kho báu (tính điểm)

---

## Flow hoạt động

### MongoDB làm trung gian giao tiếp

**Worker** và **Server** giao tiếp hoàn toàn qua MongoDB:
- Server **GHI** actions vào `PlayerActions` collection
- Server **ĐỌC** game state từ `Games` collection
- Worker **ĐỌC** actions từ `PlayerActions` collection
- Worker **GHI** game state vào `Games` collection

```
Player → Server (REST API) → MongoDB (PlayerActions: pending)
                                      ↓
                              Worker polls & reads
                                      ↓
                              Process in game loop
                                      ↓
                              MongoDB (PlayerActions: processed)
                              MongoDB (Games: updated state)
                                      ↓
                              Server reads ← MongoDB
                                      ↓
                              Player ← Server (REST API)
```

### Khởi tạo & Start game
```
Admin → POST /game/init (Worker)
     → POST /game/:id/start (Worker)
     → Game loop bắt đầu chạy
```

### Player tham gia
```
Client → WebSocket connect với token
      → emit('register', { gameId, playerId })
      → Nhận event 'registered'
      → Bắt đầu lắng nghe events
```

### Player thực hiện hành động
```
Client → POST /api/game/:id/player/:pid/move (Server)
      → Server validates
      → MongoDB.insert({ gameId, playerId, actionType: 'move', status: 'pending' })
      → Response 200 OK với actionId
      
      [Trong tick tiếp theo]
Worker → Poll MongoDB: find({ status: 'pending' })
      → Read pending actions
      → Queue vào in-memory actionQueue
      → Update MongoDB: { status: 'processed' }
      → Xử lý actions trong game loop
      → Save game state to MongoDB
      → Emit 'player:position:changed' (Socket)
      → Emit 'game:tick:complete' (Socket)
      
Client ← Nhận events qua WebSocket
      → GET /api/game/:id/map (Server)
      → Server reads from MongoDB
      → Response với updated state
```

### Mỗi Game Tick
```
Worker (mỗi 500ms): 
  1. currentTurn++
  2. Emit 'turn:new' với turn number
  
  3. POLL ACTIONS: Query MongoDB
     - find({ gameId, status: 'pending' })
     - Add tất cả vào actionQueue
     - Update MongoDB: status = 'processed'
  
  4. PROCESS ACTIONS: Xử lý tất cả actions trong queue
     - Sort by timestamp (FIFO)
     - processMove() → emit 'player:position:changed'
     - processTrap() → emit 'trap:placed'
     - handleCollision() → emit 'player:collision', 'player:energy:changed'
     - processDropTreasure() → emit 'player:score:changed'
     - Clear queue sau khi xử lý xong
  
  5. UPDATE MAP STATE:
     - Rebuild owners matrix
  
  6. SAVE TO MONGODB:
     - await saveGameState() - ĐỒNG BỘ mỗi tick
  
  7. EMIT SYNC COMPLETE:
     - emit 'game:tick:complete'
     - Message: "Actions synchronized. Please fetch updated game state."
  
  8. Chờ actions mới cho tick tiếp theo
  9. Kiểm tra endGame conditions
```

### Kết thúc game
```
Worker → endGame()
      → Emit 'game:end' với result
      → Lưu final state vào DB
      → Dừng game loop
      → Xóa khỏi active games
```

---

## Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/deep_sea_voyager

# Server
PORT=3000

# Worker
WORKER_PORT=3001

# Game Configuration
GAME_TICK_INTERVAL=500          # Milliseconds per tick
GAME_MAX_TURNS=1200             # Max game duration
GAME_MAX_ENERGY=100             # Max player energy
GAME_ENERGY_RESTORE=10          # Energy restored per rest
GAME_MAX_TRAPS_PER_PLAYER=5     # Trap limit
GAME_MAX_TRAP_DANGER=50         # Max danger value
```

---

## Deployment

### Development
```bash
npm start  # Chạy cả server và worker concurrently
```

### Production
```bash
# Terminal 1 - Server
npm run start:server

# Terminal 2 - Worker
npm run start:worker
```

### Docker
```bash
docker-compose up
```

---

## Security Notes

1. **Socket Authentication:** Token required in handshake
2. **API Validation:** All endpoints validate gameId, playerId
3. **Worker Isolation:** Port 3001 chỉ cho internal/admin access
4. **Action Queue:** FIFO prevents race conditions
5. **DB Persistence:** Auto-save every 10 ticks + game end

---

## Key Design Decisions

### MongoDB làm Message Queue

**PlayerActions collection:**
```javascript
{
  gameId: "game-001",
  playerId: "player1",
  actionType: "move",  // move|trap|rest|pick-treasure|drop-treasure
  data: { target: { x: 5, y: 10 } },
  status: "pending",   // pending|processed|failed
  timestamp: ISODate("2025-11-30T10:30:00Z"),
  processedAt: ISODate("2025-11-30T10:30:00.500Z"),
  error: null
}
```

**Indexes:**
- `{ gameId: 1, status: 1, timestamp: 1 }` - Query hiệu quả cho worker poll
- `{ playerId: 1, timestamp: 1 }` - Track player actions

### Tại sao dùng MongoDB thay vì in-memory queue?

1. **Server (REST API)**
   - Scale independently cho traffic cao
   - Stateless, dễ load balance
   - Clear API contract cho clients

2. **Socket (Events Only)**
   - Giảm tải cho server (không xử lý logic)
   - Real-time updates mà không blocking
   - Clients không cần polling

3. **Worker (Game Loop)**
   - Tập trung xử lý game logic
   - Single source of truth cho game state
   - Dễ debug và monitor game performance
   - Có thể restart mà không ảnh hưởng API server

### Tại sao Socket không nhận actions?

- **Separation of Concerns:** REST cho commands, WebSocket cho notifications
- **Easier Testing:** REST endpoints có thể test với curl/Postman
- **Better Logging:** HTTP requests dễ log và audit hơn WebSocket messages
- **Retry Logic:** HTTP có built-in retry, WebSocket cần implement riêng
- **Load Balancing:** REST dễ load balance hơn stateful WebSocket connections

---

## Testing

### Server API
```bash
# Sử dụng rest-client/server.api.http
```

### Worker API
```bash
# Sử dụng rest-client/worker.api.http
```

### Socket Events
```javascript
// Sử dụng socket.io-client
const io = require('socket.io-client');
const socket = io('http://localhost:3000', {
  auth: { token: 'VALID_SECRET_TOKEN_123' }
});

socket.emit('register', { gameId: 'game-001', playerId: 'player1' });
socket.on('game:tick:complete', (data) => console.log('Tick:', data.turn));
socket.on('player:position:changed', (data) => console.log('Move:', data));
```

---

## Monitoring

### Logs
- Server: API requests, authentication
- Worker: Tick processing, game events, DB saves
- Socket: Connections, registrations, disconnections

### Metrics
- Active games count: Worker `/health` endpoint
- Player connections: Socket connection count
- Tick processing time: Worker logs
- DB save frequency: Every 10 ticks + game end

---

## Troubleshooting

### Player không nhận events
- Kiểm tra đã emit `register` event chưa
- Verify token authentication
- Check gameId/playerId đúng

### Actions không được xử lý
- Kiểm tra Worker đang chạy
- Verify game status = 'playing'
- Check action queue trong `/game/:id/state`

### Game không tự động kết thúc
- Check MAX_TURNS configuration
- Verify endGame conditions trong gameLoop.ts
- Xem Worker logs

---

*Generated: November 30, 2025*
