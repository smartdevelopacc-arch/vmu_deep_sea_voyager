# Dashboard Features Guide

## Tổng quan Dashboard

Dashboard quản lý game Deep Sea Voyager với các tính năng chính:
- **Dashboard**: Tổng quan hệ thống
- **Players**: Quản lý danh sách players
- **Games**: Quản lý games (create, start, stop)
- **Game Control**: Theo dõi chi tiết game với map visualization

---

## 🎮 Tính năng Create Game

### Truy cập
- Click nút **"➕ Create Game"** từ trang Games
- Hoặc truy cập: `http://localhost:5173/games/create`

### Các bước tạo game

#### 1. Game Information
- **Game ID** (bắt buộc): Mã định danh unique cho game (vd: `game001`)
- **Game Name** (tùy chọn): Tên mô tả game (vd: `Battle of the Deep`)

#### 2. Map Configuration
- **Width** (10-50): Chiều rộng map
- **Height** (10-50): Chiều cao map
- **Map Template**: Chọn template có sẵn
  - Simple: 10x10
  - Medium: 20x20
  - Large: 30x30
  - Custom: Tự chọn kích thước

#### 3. Players Selection
- Chọn **ít nhất 2 players** từ danh sách
- Click vào player card để chọn/bỏ chọn
- Player được chọn sẽ có border xanh và dấu ✓

#### 4. Submit
- Click **"🚀 Create Game"**
- Hệ thống sẽ tự động:
  - Generate map với obstacles, treasures, waves
  - Đặt players ở các góc map (bases)
  - Khởi tạo game trong database
  - Redirect đến trang Game Control

### Map Generation Logic

**Obstacles** (15% tỷ lệ ngẫu nhiên):
- Được đặt random trên map
- Hiển thị bằng icon 🧱

**Treasures** (phân phối sparse):
- 100 points: 2% tỷ lệ
- 80 points: 1% tỷ lệ (thêm)
- 50 points: 2% tỷ lệ (thêm)
- Hiển thị bằng icon 💎

**Wave Energy** (gradient từ tâm):
- Level 1-3 dựa vào khoảng cách từ tâm map
- Xa tâm hơn = wave energy cao hơn
- Hiển thị bằng màu xanh (blue) với độ đậm nhạt khác nhau

**Bases**:
- Đặt ở các góc map: (0,0) và (width-1, height-1)
- Hiển thị bằng icon 🏠

---

## 🗺️ Map Viewer Component

### Visualization Features

#### Cell Colors
- **Background**: Màu xanh (blue) với opacity thay đổi
  - Wave 1: `rgba(59, 130, 246, 0.2)` - nhạt nhất
  - Wave 2: `rgba(59, 130, 246, 0.4)` - trung bình
  - Wave 3: `rgba(59, 130, 246, 0.6)` - đậm nhất
- **Obstacles**: Màu xám đá `#78716c`

#### Icons trên Map
- 🏠 **Base**: Vị trí xuất phát của players
- 👤 **Player**: Vị trí hiện tại của player
- 💎 **Treasure**: Kho báu (hover để xem điểm)
- 🪤 **Trap**: Bẫy đã đặt bởi players
- 🧱 **Obstacle**: Chướng ngại vật

#### Interactive Features
- **Hover**: Cell sẽ phóng to khi hover
- **Tooltip**: Hiển thị thông tin chi tiết:
  - Tọa độ (x, y)
  - Wave energy level
  - Treasure value (nếu có)
  - Player code (nếu có)

#### Legend (Chú thích)
- Hiển thị ở dưới map
- Giải thích tất cả icons và wave colors
- Wave samples: 3 màu xanh từ nhạt đến đậm

### Responsive Design
- Map tự động scale theo kích thước màn hình
- `max-width: 100%`
- `max-height: 70vh`
- `aspect-ratio: 1` (giữ tỷ lệ vuông)
- Font size động: `clamp(10px, 1.5vw, 20px)`

---

## 🎯 Game Control với Map

### Real-time Updates
- Map tự động cập nhật khi:
  - Players di chuyển
  - Treasures được thu thập
  - Traps được đặt
  - Turn thay đổi

### Map Info Header
- Hiển thị kích thước map: `width × height`
- Hiển thị current turn number

### Integration với Socket.IO
```typescript
// Tự động nhận updates
useGameSocket(gameId, () => {
  // Map data được refresh
  // Players positions được update
})
```

---

## 📱 Navigation Flow

```
Dashboard
  ├── Players (/players)
  ├── Games (/games)
  │   ├── Create Game (/games/create)
  │   └── Game Control (/game/:id)
  └── [Stats & Overview]
```

---

## 🚀 Development URLs

- **Dashboard Dev**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Socket.IO**: http://localhost:3000/socket.io

---

## 💡 Tips

### Tạo Game nhanh
1. Chọn template "Medium" (20x20)
2. Chọn 2 players đầu tiên
3. Đặt gameId ngắn gọn (vd: `g1`, `test`)
4. Click Create

### Debug Map
- Hover vào từng cell để xem thông tin chi tiết
- Check browser console nếu map không hiển thị
- Verify game state có `map` object với `width`, `height`, `obstacles`, `treasures`, `waves`

### Performance
- Map size > 30x30 có thể render chậm
- Recommend: 20x20 cho development
- Production: tùy theo số lượng players

---

## 🔧 API Endpoints Used

### Create Game
```
POST /api/admin/init
Body: {
  gameId: string
  mapData: {
    width: number
    height: number
    obstacles: number[][]
    treasures: number[][]
    waves: number[][]
    bases: [number, number][]
  }
  players: {
    playerId: string
    teamId: string
    position: [number, number]
    energy: number
  }[]
}
```

### Get Game State
```
GET /api/game/:gameId/status
Response: {
  gameId: string
  status: 'waiting' | 'playing' | 'finished'
  currentTurn: number
  map: MapData
  players: Player[]
}
```

---

## 🐛 Troubleshooting

### Map không hiển thị
- Check: `gameState.map` có tồn tại không
- Verify: `mapData.width` và `mapData.height` > 0
- Console: Xem error logs

### Icons không hiển thị
- Check: `players` array có position không
- Verify: `treasures` và `obstacles` matrices đúng format
- Browser: Support emoji icons

### Performance issues
- Giảm map size
- Tắt hover effects (CSS)
- Disable real-time updates tạm thời

---

## 📝 Component Props

### MapViewer.vue
```typescript
interface Props {
  mapData: {
    width: number
    height: number
    obstacles?: number[][]
    treasures?: number[][]
    waves?: number[][]
    bases?: any[]
    traps?: any[]
  }
  players?: Array<{
    code: string
    position: { x: number, y: number }
  }>
  currentTurn?: number
}
```

---

## 🎨 Styling Customization

### Colors
- **Primary Blue**: `#3b82f6`
- **Success Green**: `#10b981`
- **Danger Red**: `#ef4444`
- **Wave Gradient**: Blue with opacity 0.2-0.6

### Adjust Wave Colors
File: `dashboard/src/components/MapViewer.vue`
```javascript
const opacity = 0.2 + (wave - 1) * 0.2
// Modify formula for different gradients
```

### Adjust Cell Size
```css
.map-grid {
  max-height: 70vh; /* Thay đổi chiều cao */
}

.cell-content {
  font-size: clamp(10px, 1.5vw, 20px); /* Thay đổi size icons */
}
```
