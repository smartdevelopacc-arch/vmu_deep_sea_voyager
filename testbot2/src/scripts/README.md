# TestBot Scripts - Special Bot Behaviors

Thư mục này chứa các script bot với hành vi đặc biệt để test các tính năng game.

## Scripts

### 1. Trap Hunter Bot (`trap-hunter.ts`)

Bot chuyên tìm và dẫm trap của đối thủ để test xử lý hành vi gặp trap.

**Hành vi:**
- Scan toàn bộ bản đồ tìm trap của đối thủ
- Di chuyển tới trap gần nhất
- Cố gắng dẫm vào trap để kích hoạt
- Tránh obstacle và base
- Lặp lại quá trình với trap tiếp theo

**Sử dụng:**
```bash
# Chạy với ts-node
ts-node src/scripts/trap-hunter.ts <gameId> <playerId>

# Ví dụ:
ts-node src/scripts/trap-hunter.ts trap-test-game hunter-bot

# Với environment variables
GAME_ID=trap-test-game PLAYER_ID=hunter API_URL=http://localhost:3000 ts-node src/scripts/trap-hunter.ts
```

**Environment Variables:**
- `GAME_ID` - ID của game
- `PLAYER_ID` - ID của bot player
- `API_URL` - URL của game API (mặc định: http://localhost:3000)
- `ACTION_INTERVAL` - Thời gian giữa các action (ms, mặc định: 2000)

**Test Case:**
1. Tạo game với 2 players
2. Cho player 1 đặt trap ở một số vị trí
3. Chạy trap-hunter bot với player 2
4. Quan sát bot tìm và dẫm vào trap
5. Kiểm tra log xem trap có được xử lý đúng (mất energy, trap bị xóa)

---

### 2. Ramming Bot (`ramming-bot.ts`)

Bot chuyên tìm và đâm thuyền đối thủ để test collision mechanics.

**Hành vi:**
- Tìm vị trí của tất cả đối thủ
- Chọn đối thủ gần nhất làm mục tiêu
- Di chuyển trực tiếp về phía đối thủ
- Va chạm để test collision damage
- Tiếp tục tấn công đối thủ tiếp theo

**Sử dụng:**
```bash
# Chạy với ts-node
ts-node src/scripts/ramming-bot.ts <gameId> <playerId>

# Ví dụ:
ts-node src/scripts/ramming-bot.ts collision-test-game ramming-bot

# Với environment variables
GAME_ID=collision-test-game PLAYER_ID=ram-bot API_URL=http://localhost:3000 ts-node src/scripts/ramming-bot.ts
```

**Environment Variables:**
- `GAME_ID` - ID của game
- `PLAYER_ID` - ID của bot player
- `API_URL` - URL của game API (mặc định: http://localhost:3000)
- `ACTION_INTERVAL` - Thời gian giữa các action (ms, mặc định: 1500)

**Test Case:**
1. Tạo game với 3+ players
2. Chạy ramming bot với player 1
3. Chạy normal bot hoặc trap-hunter với players khác
4. Quan sát collision khi bot đâm vào nhau
5. Kiểm tra damage, energy loss, và score changes

---

## Thêm Scripts Mới Vào package.json

Để chạy dễ hơn, thêm vào `package.json`:

```json
{
  "scripts": {
    "trap-hunter": "ts-node src/scripts/trap-hunter.ts",
    "ramming-bot": "ts-node src/scripts/ramming-bot.ts"
  }
}
```

Sau đó chạy:
```bash
npm run trap-hunter trap-test-game hunter-bot
npm run ramming-bot collision-test-game ram-bot
```

---

## Debug Tips

1. **Xem log chi tiết:**
   - Bot in ra console mọi action và decision
   - Sử dụng `console.log` để debug behavior

2. **Test với nhiều bot:**
   - Mở nhiều terminal
   - Chạy các bot khác nhau cùng lúc
   - Quan sát interaction

3. **Kiểm tra game state:**
   - Mở dashboard: http://localhost:5173
   - Xem real-time updates
   - Kiểm tra trap positions, energy, scores

4. **Test edge cases:**
   - Bot bị mắc kẹt giữa obstacle
   - Nhiều bot cùng dẫm một trap
   - Collision đồng thời của 3+ bot
   - Bot hết energy khi đang chase

---

## Tạo Script Mới

Để tạo bot behavior mới:

1. Copy một trong hai script hiện có
2. Sửa logic trong `executeAction()`
3. Implement behavior mong muốn
4. Test với game thật

**Template cơ bản:**
```typescript
class MyCustomBot {
  private async executeAction() {
    await this.fetchGameState();
    
    // Your custom logic here
    const action = this.decideAction();
    
    await this.sendAction(action.type, action.direction);
  }
  
  private decideAction() {
    // Your decision logic
    return { type: 'move', direction: 'north' };
  }
}
```

---

## Notes

- Tất cả bot đều graceful shutdown với SIGINT/SIGTERM
- Interval time có thể điều chỉnh qua environment variable
- Bot tự động rest khi không có action hợp lệ
- Terrain và obstacle được cache để tránh fetch nhiều lần
