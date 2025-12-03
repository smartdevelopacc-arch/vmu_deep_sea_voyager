# Socket Events - Thông báo real-time cho Players

## Kiến trúc mới: Single Process với Shared Socket.IO

### Cấu trúc
```
┌─────────────────────────────────────────────┐
│         Single Node.js Process              │
│                                             │
│  ┌──────────────┐      ┌────────────────┐  │
│  │    SERVER    │      │  GAME WORKER   │  │
│  │  (Port 3000) │      │  (Port 3001)   │  │
│  │              │      │                │  │
│  │  REST API    │      │  Game Loop     │  │
│  │              │      │                │  │
│  └──────┬───────┘      └────────┬───────┘  │
│         │                       │          │
│         │  Chia sẻ Socket.IO    │          │
│         └───────────┬───────────┘          │
│                     │                      │
│              ┌──────▼──────┐               │
│              │  Socket.IO  │               │
│              │  Instance   │               │
│              └──────┬──────┘               │
└─────────────────────┼──────────────────────┘
                      │
                      │ WebSocket
                      ▼
              ┌───────────────┐
              │    CLIENTS    │
              │   (Browsers)  │
              └───────────────┘
```

### Lợi ích
- ✅ Worker và Server chia sẻ cùng Socket.IO instance
- ✅ Worker emit events trực tiếp, không cần HTTP calls
- ✅ Giảm latency, tăng performance
- ✅ Đơn giản hơn, dễ debug hơn
- ✅ Phù hợp cho development và production nhỏ/vừa

---

## Flow xử lý và thông báo

### 1️⃣ Player gửi action
```
Client → POST /api/game/:id/player/:pid/move
      ↓
Server validates và ghi vào MongoDB
      ↓
PlayerActionModel.create({ status: 'pending' })
      ↓
Response 200 OK
```

### 2️⃣ Worker xử lý trong tick (~500ms)
```typescript
// src/core/gameLoop.ts - processTick()

async function processTick(gameId: string) {
  // BƯỚC 1: Load state từ DB
  const gameState = await loadGameState(gameId);
  
  // BƯỚC 2: Poll actions từ DB
  const actions = await pollActionsFromDB(gameId, gameState);
  
  // BƯỚC 3: Process actions
  actions.forEach(action => {
    processAction(gameState, action);
  });
  
  // BƯỚC 4: Update map state (collisions, treasures, etc)
  updateMapState(gameState);
  
  // BƯỚC 5: Save state vào DB
  await saveGameState(gameState);
  
  // BƯỚC 6: 🔔 EMIT EVENTS QUA SOCKET.IO 🔔
  emitTickComplete(gameId, gameState.currentTurn);
  
  console.log(`✅ Tick ${gameState.currentTurn} completed`);
}
```

### 3️⃣ Events được broadcast đến clients
```typescript
// src/core/socketEvents.ts

export const emitTickComplete = (gameId: string, turn: number) => {
    io.to(`game:${gameId}`).emit('game:tick:complete', { 
        turn,
        message: 'Actions synchronized. Please fetch updated game state.'
    });
};
```

### 4️⃣ Client nhận event và fetch state mới
```javascript
// Client-side code
socket.on('game:tick:complete', async ({ turn }) => {
  console.log(`🔔 Tick ${turn} completed! Fetching new state...`);
  
  // Fetch updated state from REST API
  const response = await fetch(`/api/game/${gameId}/map`);
  const newState = await response.json();
  
  // Update UI
  updateGameUI(newState);
});
```

---

## Danh sách Events

### 🎯 Game Lifecycle Events

#### `game:tick:complete`
**Khi nào:** Sau mỗi tick (~500ms), sau khi state đã được lưu vào DB

**Payload:**
```json
{
  "turn": 123,
  "message": "Actions synchronized. Please fetch updated game state."
}
```

**Client nên làm gì:**
- Fetch lại game state từ REST API
- Cập nhật UI với state mới
- Hiển thị số turn hiện tại

---

#### `turn:new`
**Khi nào:** Đầu mỗi tick, trước khi xử lý actions

**Payload:**
```json
{
  "turn": 124
}
```

**Client nên làm gì:**
- Cập nhật counter số turn
- Chuẩn bị UI cho tick tiếp theo

---

#### `game:end`
**Khi nào:** Khi game kết thúc (hết turns hoặc điều kiện win)

**Payload:**
```json
{
  "result": {
    "status": "finished",
    "winner": "player1",
    "finalScores": [...]
  }
}
```

**Client nên làm gì:**
- Hiển thị màn hình kết thúc
- Fetch kết quả chi tiết từ `/api/game/:id/result`
- Dừng polling/updates

---

### 👤 Player State Events

#### `player:position:changed`
**Khi nào:** Khi player di chuyển thành công

**Payload:**
```json
{
  "playerId": "player1",
  "position": { "x": 5, "y": 10 }
}
```

**Client nên làm gì:**
- Animate player movement
- Cập nhật mini-map
- Hiển thị trail/path

---

#### `player:energy:changed`
**Khi nào:** Khi energy thay đổi (move, rest, collision, trap)

**Payload:**
```json
{
  "playerId": "player1",
  "energy": 75
}
```

**Client nên làm gì:**
- Update energy bar
- Hiển thị warning nếu energy thấp
- Show energy gain/loss animation

---

#### `player:score:changed`
**Khi nào:** Khi player drop treasure về base

**Payload:**
```json
{
  "playerId": "player1",
  "score": 350
}
```

**Client nên làm gì:**
- Update score display
- Show score increase animation
- Update leaderboard

---

### 💥 Combat & Collision Events

#### `player:collision`
**Khi nào:** Khi 2 players va chạm

**Payload:**
```json
{
  "attackerId": "player1",
  "victimId": "player2",
  "energyLoss": 20
}
```

**Client nên làm gì:**
- Hiển thị collision animation
- Show damage numbers
- Play sound effects
- Camera shake/effects

---

### 💎 Map Events

#### `treasure:collected`
**Khi nào:** Khi player pick treasure

**Payload:**
```json
{
  "playerId": "player1",
  "treasure": 50
}
```

**Client nên làm gì:**
- Remove treasure từ map
- Show collect animation
- Update player's carried treasure indicator

---

#### `trap:placed`
**Khi nào:** Khi player đặt bẫy

**Payload:**
```json
{
  "playerId": "player1",
  "position": { "x": 7, "y": 8 },
  "danger": 30
}
```

**Client nên làm gì:**
- Hiển thị trap trên map (nếu visible)
- Show placement animation
- Update player's trap count

---

#### `score:update`
**Khi nào:** Cập nhật toàn bộ bảng điểm (định kỳ)

**Payload:**
```json
{
  "scores": [
    { "playerId": "player1", "score": 350 },
    { "playerId": "player2", "score": 280 }
  ]
}
```

**Client nên làm gì:**
- Update full leaderboard
- Highlight position changes
- Show ranking arrows

---

## Client Implementation Example

### Kết nối và đăng ký
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'VALID_SECRET_TOKEN_123'
  }
});

// Đăng ký vào game
socket.emit('register', {
  gameId: 'game-001',
  playerId: 'player1'
});

socket.on('registered', ({ gameId, playerId }) => {
  console.log(`✅ Registered to game ${gameId} as ${playerId}`);
});
```

### Lắng nghe events
```javascript
// Main tick event - Fetch full state
socket.on('game:tick:complete', async ({ turn }) => {
  console.log(`🔔 Tick ${turn} completed`);
  
  const [map, players, leaderboard] = await Promise.all([
    fetch(`/api/game/${gameId}/map`).then(r => r.json()),
    fetch(`/api/game/${gameId}/players`).then(r => r.json()),
    fetch(`/api/game/${gameId}/leaderboard`).then(r => r.json())
  ]);
  
  updateGameState({ map, players, leaderboard, turn });
});

// Realtime updates for animations
socket.on('player:position:changed', ({ playerId, position }) => {
  animatePlayerMove(playerId, position);
});

socket.on('player:energy:changed', ({ playerId, energy }) => {
  updateEnergyBar(playerId, energy);
});

socket.on('player:collision', ({ attackerId, victimId, energyLoss }) => {
  showCollisionEffect(attackerId, victimId, energyLoss);
});

socket.on('treasure:collected', ({ playerId, treasure }) => {
  showTreasureCollectAnimation(playerId, treasure);
});

socket.on('game:end', ({ result }) => {
  showGameEndScreen(result);
});
```

---

## Best Practices

### ✅ DO
- Fetch full state khi nhận `game:tick:complete`
- Sử dụng các events khác cho animations/effects
- Implement retry logic cho REST API calls
- Debounce UI updates để tránh lag
- Show loading states khi fetching

### ❌ DON'T
- Đừng dựa 100% vào socket events cho game state
- Đừng gửi actions qua socket (phải qua REST API)
- Đừng tin tưởng client-side validation hoàn toàn
- Đừng update UI trực tiếp từ events mà không verify

---

## Performance Tips

### Reduce REST API calls
```javascript
// Cache state locally
let cachedState = {};
let lastFetchTurn = -1;

socket.on('game:tick:complete', async ({ turn }) => {
  // Only fetch if turn changed
  if (turn > lastFetchTurn) {
    cachedState = await fetchGameState();
    lastFetchTurn = turn;
    updateUI(cachedState);
  }
});
```

### Optimize animations
```javascript
// Use events for immediate feedback
socket.on('player:position:changed', ({ playerId, position }) => {
  // Immediate animation
  animatePlayerMove(playerId, position);
});

// Then sync with server state on tick complete
socket.on('game:tick:complete', async () => {
  const actualState = await fetchGameState();
  reconcileState(actualState); // Fix any desyncs
});
```

---

## Troubleshooting

### Events không được nhận
1. Kiểm tra socket đã connect thành công chưa
2. Verify đã emit `register` event chưa
3. Check console logs trên server
4. Verify `gameId` và `playerId` đúng

### Desynced state
1. Force fetch state mới từ REST API
2. Implement reconciliation logic
3. Show warning/reload UI nếu cần

### Latency cao
1. Kiểm tra network connection
2. Optimize DB queries trên server
3. Reduce tick interval nếu cần
4. Use Redis for caching

---

## Migration Notes

### Từ Worker riêng → Single Process
- ✅ Worker endpoints vẫn available trên port 3001
- ✅ Socket events giờ hoạt động tự động
- ✅ Không cần HTTP calls giữa Server ↔ Worker
- ✅ Performance tốt hơn, latency thấp hơn
