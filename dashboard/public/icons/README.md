# Map Icons

Đặt các file PNG vào thư mục này để customize icon trên map.

## Tên file được hỗ trợ:

- `base.png` - Icon căn cứ (mặc định: 🏠)
- `player.png` - Icon người chơi (mặc định: 👤)  
- `treasure.png` - Icon kho báu (mặc định: 💎)
- `trap.png` - Icon bẫy (mặc định: 🪤)
- `island.png` - Icon đảo (mặc định: 🏝️)

## Lưu ý:

- Kích thước khuyến nghị: 32x32px hoặc 64x64px
- Định dạng: PNG với nền trong suốt
- Nếu không có file PNG, hệ thống tự động dùng emoji mặc định
- Sau khi thêm/sửa icon, chạy: `npm run build:dashboard`

## Cách sử dụng:

1. Tạo/tìm file PNG icon bạn muốn dùng
2. Đổi tên file theo đúng tên trên (ví dụ: `base.png`)
3. Copy vào thư mục `dashboard/public/icons/`
4. Build lại dashboard: `npm run build:dashboard`
5. Khởi động dashboard: `npm run start:dashboard`

