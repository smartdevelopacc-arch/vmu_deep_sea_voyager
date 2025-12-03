# Assets Directory

Thư mục chứa tài nguyên tĩnh của hệ thống.

## players/

Thư mục chứa thông tin các đội tham gia game.

### Cấu trúc

Mỗi đội là một file JSON với tên là `<player_code>.json`:

```
assets/players/
├── team_alpha.json
├── team_beta.json
└── ...
```

### File Format

```json
{
  "name": "Tên đội",
  "slogan": "Khẩu hiệu của đội",
  "logo": "data:image/png;base64,iVBORw0KGgo..."
}
```

**Lưu ý:**
- File name (không bao gồm `.json`) sẽ là `player_code` trong hệ thống
- `logo`: Base64-encoded PNG image (data URI format)
- Khuyến nghị: Ảnh nhỏ, tối ưu (10x10 hoặc 50x50 pixels)

### Tạo Base64 Logo

Từ file ảnh PNG:
```bash
base64 -i avatar.png | tr -d '\n' > logo.txt
# Thêm prefix: data:image/png;base64,<content>
```

Hoặc sử dụng online tool: https://www.base64-image.de/

## Import vào Database

Khi server khởi động, tất cả players trong thư mục này sẽ được tự động import vào MongoDB:

```bash
npm run cli import-players
```

## API Endpoints

- `GET /api/players` - Lấy danh sách tất cả players có sẵn

```bash
curl http://localhost:3000/api/players
```

Response:
```json
{
  "players": [
    {
      "code": "team_alpha",
      "name": "Team Alpha",
      "logo": "players/team_alpha/avatar.png",
      "slogan": "First to explore, first to conquer!"
    }
  ]
}
```

## Sử dụng trong Game

Khi tạo game mới, sử dụng `player_code` từ danh sách này:

```bash
curl -X POST http://localhost:3000/api/admin/game/init \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "game001",
    "mapData": {...},
    "players": [
      {
        "playerId": "team_alpha",
        "position": {"x": 0, "y": 0},
        "energy": 100
      }
    ]
  }'
```
