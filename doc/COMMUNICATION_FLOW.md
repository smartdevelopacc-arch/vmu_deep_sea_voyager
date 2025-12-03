# Luồng giao tiếp qua MongoDB

## Kiến trúc tổng quan

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   CLIENT    │         │   SERVER    │         │   WORKER    │
│  (Browser)  │         │  (Port 3000)│         │  (Port 3001)│
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                       │
       │  1. POST /move        │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │                  ┌────▼────┐                  │
       │                  │ MongoDB │                  │
       │                  │ Actions │                  │
       │                  │ pending │                  │
       │                  └────┬────┘                  │
       │  2. Response OK       │                       │
       │<──────────────────────│                       │
       │                       │                       │
       │                       │    3. Poll actions    │
       │                       │<──────────────────────│
       │                       │                       │
       │                  ┌────▼────┐                  │
       │                  │ MongoDB │                  │
       │                  │ Actions │                  │
       │                  │processed│                  │
       │                  └────┬────┘                  │
       │                       │                       │
       │                       │    4. Save state      │
       │                       │<──────────────────────│
       │                       │                       │
       │                  ┌────▼────┐                  │
       │                  │ MongoDB │                  │
       │                  │  Games  │                  │
       │                  │ updated │                  │
       │                  └────┬────┘                  │
       │  5. GET /status       │                       │
       │──────────────────────>│                       │
       │                       │                       │
       │  6. Read from DB      │                       │
       │<──────────────────────│                       │
       │                       │                       │
```

## Chi tiết các bước

### 1️⃣ Client gửi action (POST /move)
```http
POST /api/game/game-001/player/player1/move
Content-Type: application/json

{
  "direction": "north"
}
```

**Server xử lý:**
```typescript
// src/controllers/action.controller.ts
const action = await PlayerActionModel.create({
  gameId: 'game-001',
  playerId: 'player1',
  actionType: 'move',
  data: { target: { x: 5, y: 4 } },
  status: 'pending',
  timestamp: new Date()
});
```

**MongoDB - PlayerActions collection:**
```json
{
  "_id": "action-123",
  "gameId": "game-001",
  "playerId": "player1",
  "actionType": "move",
  "data": { "target": { "x": 5, "y": 4 } },
  "status": "pending",
  "timestamp": "2025-11-30T10:00:00Z"
}
```

### 2️⃣ Server trả response ngay lập tức
```json
{
  "success": true,
  "actionId": "action-123",
  "target": { "x": 5, "y": 4 }
}
```

**Lưu ý:** Server **KHÔNG** đợi Worker xử lý, trả về ngay.

---

### 3️⃣ Worker poll actions (mỗi tick ~500ms)
```typescript
// src/core/gameLoop.ts - processTick()
const gameState = await loadGameState(gameId); // Load từ DB

// Poll pending actions
const pendingActions = await PlayerActionModel.find({
  gameId: gameId,
  status: 'pending'
}).sort({ timestamp: 1 }); // FIFO

// Process từng action
for (const action of pendingActions) {
  processAction(gameState, action);
  
  // Mark as processed
  await PlayerActionModel.updateOne(
    { _id: action._id },
    { $set: { status: 'processed', processedAt: new Date() } }
  );
}
```

**MongoDB - PlayerActions collection (sau khi xử lý):**
```json
{
  "_id": "action-123",
  "gameId": "game-001",
  "playerId": "player1",
  "actionType": "move",
  "data": { "target": { "x": 5, "y": 4 } },
  "status": "processed", // ✅ Updated
  "timestamp": "2025-11-30T10:00:00Z",
  "processedAt": "2025-11-30T10:00:00.500Z" // ✅ Added
}
```

---

### 4️⃣ Worker lưu state vào MongoDB
```typescript
// src/core/gamePersistence.ts - saveGameState()
await GameModel.updateOne(
  { code: gameId },
  {
    $set: {
      status: 'playing',
      currentTurn: gameState.currentTurn,
      players: playersArray, // Updated positions, energy, scores
      'map.treasures': gameState.map.treasures,
      'map.traps': trapsArray
    }
  }
);
```

**MongoDB - Games collection:**
```json
{
  "code": "game-001",
  "name": "Game game-001",
  "status": "playing",
  "currentTurn": 145,
  "players": [
    {
      "code": "player1",
      "name": "Player player1",
      "position": { "x": 5, "y": 4 }, // ✅ Updated
      "energy": 85, // ✅ Updated (-5 energy for move)
      "score": 120
    }
  ],
  "map": {
    "width": 50,
    "height": 50,
    "terrain": [...],
    "treasures": [...],
    "traps": [...] // ✅ May have changed
  }
}
```

---

### 5️⃣ Client lấy state mới (GET /status)
```http
GET /api/game/game-001/status
```

**Server xử lý:**
```typescript
// src/controllers/gameStatus.controller.ts
const gameState = await loadGameState(gameId); // Đọc từ MongoDB

res.json({
  status: gameState.status,
  currentTurn: gameState.currentTurn
});
```

### 6️⃣ Response với data từ DB
```json
{
  "status": "playing",
  "currentTurn": 145
}
```

---

## Lợi ích của kiến trúc này

### ✅ Tách biệt hoàn toàn Server và Worker
- Server **CHỈ** ghi actions và đọc state từ DB
- Worker **CHỈ** đọc actions và ghi state vào DB
- Không có HTTP calls giữa Server ↔ Worker
- Không có shared memory

### ✅ Stateless Worker
- Worker có thể restart bất cứ lúc nào
- Không mất dữ liệu khi worker crash
- Dễ scale horizontal (nhiều worker instances)
- Load từ DB mỗi tick → luôn có data mới nhất

### ✅ Consistency & Reliability
- MongoDB là single source of truth
- Actions được xử lý theo thứ tự FIFO (timestamp)
- Status tracking: pending → processed → failed
- Có thể retry failed actions

### ✅ Debugging & Monitoring
- Tất cả actions được log trong DB
- Có thể replay actions để debug
- Query MongoDB để xem state bất cứ lúc nào
- Không cần request worker để debug

---

## Collections MongoDB

### 1. Games
```typescript
{
  code: string,              // gameId
  name: string,
  status: 'waiting' | 'playing' | 'finished',
  currentTurn: number,
  map: IMap,                 // Full map state
  players: IPlayer[],        // All player states
  scores: Array<{playerId, score}>,
  history: Array<any>
}
```

### 2. PlayerActions
```typescript
{
  gameId: string,
  playerId: string,
  actionType: 'move' | 'trap' | 'rest' | 'pick-treasure' | 'drop-treasure',
  data: any,                 // Action-specific data
  status: 'pending' | 'processed' | 'failed',
  timestamp: Date,           // Khi action được tạo
  processedAt?: Date,        // Khi action được xử lý
  error?: string             // Nếu failed
}
```

**Indexes:**
```typescript
{ gameId: 1, status: 1, timestamp: 1 } // For efficient polling
```

---

## Performance Considerations

### Polling Interval
- Default: 500ms per tick
- Trade-off: Faster = more responsive, but more DB queries
- Configurable via `GAME_TICK_INTERVAL`

### DB Load Optimization
- Worker chỉ query actions có status='pending'
- Index trên (gameId, status, timestamp) giúp query nhanh
- Bulk update actions sau khi process

### State Persistence
- Worker save state vào DB **mỗi tick**
- Đảm bảo không mất data nếu crash
- Trade-off: More DB writes, but safer

### Scaling
- Có thể chạy nhiều worker instances
- Mỗi worker chịu trách nhiệm một subset của games
- Shard MongoDB theo gameId nếu cần
