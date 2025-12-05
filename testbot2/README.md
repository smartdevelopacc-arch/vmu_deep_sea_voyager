# Test Bot

Bot tự động chơi game để test action queue và visualization.

**Lưu ý**: Bot sử dụng **Client API** (không phải Admin API), vì vậy:
- ✅ Nhìn thấy: terrain, waves, treasures, owners
- ❌ Không thấy: traps của người chơi khác (giống như client thật)

## Cài đặt

```bash
cd testbot
npm install
```

## Cách sử dụng

### 1. Tạo game và start (từ thư mục root)

```bash
# Tạo game mới
curl -X POST http://localhost:3000/api/admin/game/init \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "bot-test-001",
    "mapData": {
      "code": "map-bot",
      "name": "Bot Test Map",
      "width": 30,
      "height": 30
    },
    "players": [
      {"code": "team_alpha", "name": "Team Alpha"},
      {"code": "team_beta", "name": "Team Beta"}
    ]
  }'

# Start game
curl -X POST http://localhost:3000/api/admin/game/bot-test-001/start
```

### 2. Chạy bot

```bash
cd testbot

# Chạy 1 bot cho team_alpha
npm start bot-test-001 team_alpha

# Chạy bot với interval custom (2000ms)
npm start bot-test-001 team_alpha http://localhost:3000/api 2000
```

### 3. Chạy nhiều bots (mỗi bot trong 1 terminal riêng)

```bash
# Terminal 1
cd testbot
npm start bot-test-001 team_alpha

# Terminal 2
cd testbot  
npm start bot-test-001 team_beta
```

### 4. Xem game trên dashboard

Mở browser: http://localhost:4173/game/bot-test-001

Bạn sẽ thấy:
- Map cập nhật real-time
- Players di chuyển tự động
- Treasures được pick up và drop
- Scores thay đổi
- Energy consumption

## Bot Behaviors

Bot có các hành vi thông minh:

1. **Energy Management**: Rest khi energy < 20
2. **Treasure Collection**: Tự động di chuyển đến treasure gần nhất
3. **Pick & Drop**: Pick treasure khi đứng trên ô có treasure
4. **Return to Base**: Quay về base khi đang mang treasure
5. **Random Exploration**: Di chuyển random khi không có mục tiêu

## Parameters

- `gameId`: ID của game
- `playerId`: ID của player (team_alpha, team_beta, etc.)
- `apiUrl`: API endpoint (default: http://localhost:3000/api)
- `interval`: Thời gian giữa các action (ms, default: 1000)

## Stop Bot

Nhấn `Ctrl+C` để dừng bot.

## Test Scenarios

### Scenario 1: Single Bot
Test bot có hoạt động đúng không

```bash
npm start bot-test-001 team_alpha
```

### Scenario 2: Multiple Bots
Test action queue khi có nhiều players

```bash
# Terminal 1
npm start bot-test-001 team_alpha

# Terminal 2  
npm start bot-test-001 team_beta
```

### Scenario 3: Fast Actions
Test với actions nhanh (500ms interval)

```bash
npm start bot-test-001 team_alpha http://localhost:3000/api 500
```

### Scenario 4: Slow Actions
Test với actions chậm (3000ms interval)

```bash
npm start bot-test-001 team_alpha http://localhost:3000/api 3000
```

## Monitoring

Xem logs của bot để debug:
- Actions được gửi
- Game state updates
- Energy levels
- Treasures found
- Errors (nếu có)

Xem logs của API server:
```bash
npx pm2 logs deep-sea-voyager
```

Xem trên dashboard:
- Real-time player movements
- Score changes
- Turn counter
- Player status

## Build

Nếu muốn build thành JavaScript:

```bash
npm run build
node dist/index.js bot-test-001 team_alpha
```
