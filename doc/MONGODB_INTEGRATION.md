# MongoDB Integration - Server ↔ Worker Communication

## Tổng quan

Server và Worker giao tiếp hoàn toàn qua MongoDB, không còn dùng in-memory shared state.

## Collections

### 1. Games
**Mục đích:** Lưu game state hiện tại

**Schema:**
```javascript
{
  code: "game-001",
  name: "Game 001",
  status: "playing",  // waiting|playing|finished
  currentTurn: 45,
  map: {
    width: 50,
    height: 50,
    terrain: [[...]],
    waves: [[...]],
    treasures: [[...]],
    traps: [[x, y, danger], ...],
    bases: [[x, y], ...],
    owners: [[...]]
  },
  players: [
    {
      playerId: "player1",
      position: { x: 10, y: 15 },
      energy: 85,
      carriedTreasure: 50,
      trapCount: 2,
      score: 150
    }
  ],
  scores: [
    { playerId: "player1", score: 150 }
  ],
  history: []
}
```

**Cập nhật bởi:** Worker (mỗi 10 ticks + game end)
**Đọc bởi:** Server (tất cả GET endpoints)

---

### 2. PlayerActions
**Mục đích:** Message queue cho player actions

**Schema:**
```javascript
{
  _id: ObjectId("..."),
  gameId: "game-001",
  playerId: "player1",
  actionType: "move",  // move|trap|rest|pick-treasure|drop-treasure
  data: {
    target: { x: 5, y: 10 }  // Specific to action type
  },
  status: "pending",  // pending|processed|failed
  timestamp: ISODate("2025-11-30T10:30:00Z"),
  processedAt: ISODate("2025-11-30T10:30:00.500Z"),
  error: null
}
```

**Indexes:**
```javascript
{ gameId: 1, status: 1, timestamp: 1 }  // Worker poll query
{ playerId: 1, timestamp: 1 }           // Player history
```

**Ghi bởi:** Server (khi nhận player actions)
**Đọc & Update bởi:** Worker (mỗi tick)

---

## Data Flow

### Server → MongoDB → Worker

**Bước 1: Client gửi action**
```http
POST /api/game/game-001/player/player1/move
{
  "direction": "north"
}
```

**Bước 2: Server xử lý**
```javascript
// action.controller.ts
const game = await GameModel.findOne({ code: gameId });
const player = game.players.find(p => p.playerId === playerId);

// Calculate target position
const target = getTargetPosition(player.position, direction);

// Insert to MongoDB
const action = await PlayerActionModel.create({
  gameId: "game-001",
  playerId: "player1",
  actionType: "move",
  data: { target: { x: 5, y: 10 } },
  status: "pending"
});

res.json({ success: true, actionId: action._id });
```

**Bước 3: Worker polls (mỗi tick)**
```javascript
// gameLoop.ts - processTick()
const pendingActions = await PlayerActionModel.find({
  gameId: "game-001",
  status: "pending"
}).sort({ timestamp: 1 }).limit(100);

for (const action of pendingActions) {
  // Add to in-memory queue
  gameState.actionQueue.push({
    playerId: action.playerId,
    type: action.actionType,
    timestamp: action.timestamp.getTime(),
    data: action.data
  });

  // Mark as processed
  action.status = "processed";
  action.processedAt = new Date();
  await action.save();
}

// Process all queued actions
actions.forEach(action => processAction(gameState, action));
```

**Bước 4: Worker saves state**
```javascript
// gamePersistence.ts
await saveGameState(gameState);  // Every 10 ticks
```

**Bước 5: Client fetches updated state**
```http
GET /api/game/game-001/map
```

**Bước 6: Server reads from MongoDB**
```javascript
// map.controller.ts
const game = await GameModel.findOne({ code: gameId });
res.json({
  currentTurn: game.currentTurn,
  terrain: game.map.terrain,
  treasures: game.map.treasures,
  // ...
});
```

---

## Action Types & Data Format

### move
```javascript
{
  actionType: "move",
  data: {
    target: { x: 10, y: 15 }
  }
}
```

### trap
```javascript
{
  actionType: "trap",
  data: {
    position: { x: 10, y: 15 },
    danger: 30
  }
}
```

### rest
```javascript
{
  actionType: "rest",
  data: {}
}
```

### pick-treasure
```javascript
{
  actionType: "pick-treasure",
  data: {}
}
```

### drop-treasure
```javascript
{
  actionType: "drop-treasure",
  data: {}
}
```

---

## Timing & Performance

### Worker Tick Cycle
```
Mỗi 500ms (GAME_TICK_INTERVAL):
  
  BƯỚC 1: Poll actions từ MongoDB
    - Query: find({ gameId, status: 'pending' })
    - Sort: timestamp ASC
    - Limit: 100 actions
    - Add to in-memory actionQueue
    - Update MongoDB: status = 'processed'
    Duration: ~5-10ms
  
  BƯỚC 2: Xử lý tất cả actions trong queue
    - Sort by timestamp (FIFO)
    - Process: move, trap, rest, pick-treasure, drop-treasure
    - Calculate collisions, energy, scores
    Duration: ~20-50ms
  
  BƯỚC 3: Cập nhật map state
    - Rebuild owners matrix
    Duration: ~5ms
  
  BƯỚC 4: Lưu game state vào MongoDB
    - Save complete state (players, map, scores)
    - SYNC operation (await)
    Duration: ~50-100ms
  
  BƯỚC 5: Emit event đồng bộ hoàn tất
    - Socket emit: 'game:tick:complete'
    - Message: "Actions synchronized. Please fetch updated game state."
    Duration: ~5ms
  
Total: ~85-170ms per tick (còn lại 330-415ms để chờ actions mới)
```

### Server Response Time
```
POST /move:
  1. Validate game exists (~10-20ms)
  2. Insert action to MongoDB (~10-30ms)
  3. Return response
  
Total: ~20-50ms
```

### Client Update Latency
```
Action submitted → Processed in next tick → State saved → Client fetches
Min: 500ms (1 tick)
Max: 5500ms (1 tick + wait for 10-tick save)
Typical: 500-1000ms
```

---

## Error Handling

### Action Processing Errors
```javascript
try {
  gameState.actionQueue.push(action);
  action.status = "processed";
} catch (err) {
  action.status = "failed";
  action.error = err.message;
}
await action.save();
```

### Query Failed Actions
```javascript
const failedActions = await PlayerActionModel.find({
  gameId: "game-001",
  status: "failed"
});
```

---

## Scalability Considerations

### Multiple Worker Instances
**Hiện tại:** 1 worker per game
**Tương lai:** Có thể scale bằng cách:
- Shard games theo gameId
- Mỗi worker chỉ poll actions của games assigned
- Dùng distributed lock (Redis) để tránh race conditions

### Database Load
**Reads per second:**
- Worker polls: 2 queries/sec (1 per tick)
- Server endpoints: ~10-50 queries/sec (tùy traffic)

**Writes per second:**
- Server actions: ~10-50 inserts/sec
- Worker updates: ~10-50 updates/sec
- Worker state saves: ~0.2 writes/sec (mỗi 10 ticks)

**Total:** ~50-200 operations/sec (MongoDB easily handles this)

---

## Monitoring Queries

### Check Pending Actions
```javascript
db.playeractions.find({ status: "pending" }).count()
```

### Actions Processing Rate
```javascript
db.playeractions.aggregate([
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 }
    }
  }
])
```

### Average Processing Time
```javascript
db.playeractions.aggregate([
  {
    $match: { status: "processed" }
  },
  {
    $project: {
      processingTime: {
        $subtract: ["$processedAt", "$timestamp"]
      }
    }
  },
  {
    $group: {
      _id: null,
      avgTime: { $avg: "$processingTime" }
    }
  }
])
```

---

## Migration Notes

### Changes Made

1. **Server Controllers:**
   - ❌ Removed: `import { getGameState } from '../core/gameLoop'`
   - ✅ Added: `import { GameModel } from '../models/game.model'`
   - ✅ Added: `import { PlayerActionModel } from '../models/playerAction.model'`
   - All endpoints now `async`

2. **Worker:**
   - ✅ Added: `pollActionsFromDB()` function
   - ✅ Modified: `processTick()` is now `async`
   - ✅ Added: MongoDB query in each tick

3. **New Files:**
   - ✅ `src/models/playerAction.model.ts`

### Breaking Changes
- Server không còn access trực tiếp in-memory game state
- Response format thay đổi: `actionId` thay vì `success: boolean`

---

*Updated: November 30, 2025*
