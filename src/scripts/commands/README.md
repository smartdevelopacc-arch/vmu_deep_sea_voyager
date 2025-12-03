# CLI Commands

Thư mục chứa các command handlers cho CLI management tool.

## Cấu trúc

Mỗi command được tổ chức trong một file riêng với structure:

```typescript
// commands/example.ts
export async function handle() {
  // Command logic here
}
```

## Available Commands

### import-players.ts
Import players từ thư mục `assets/players/` vào MongoDB.

**File format:** `assets/players/<player_code>.json`

**Usage:**
```bash
npm run cli import-players
```

### reset-db.ts
Xóa tất cả game data (games, player actions) nhưng giữ lại players.

**Usage:**
```bash
npm run cli reset-db
```

### reset-all.ts
Xóa toàn bộ database bao gồm cả players.

**Usage:**
```bash
npm run cli reset-all
```

### list-players.ts
Hiển thị danh sách players trong database.

**Usage:**
```bash
npm run cli list-players
```

### list-games.ts
Hiển thị danh sách games trong database.

**Usage:**
```bash
npm run cli list-games
```

### help.ts
Hiển thị help message với danh sách commands.

**Usage:**
```bash
npm run cli help
```

## Adding New Commands

1. Tạo file mới trong `src/scripts/commands/`:

```typescript
// commands/my-command.ts
export async function handle() {
  console.log('Executing my command...');
  // Your logic here
}
```

2. Import và register trong `cli.ts`:

```typescript
import * as myCommandCmd from './commands/my-command';

const commands = {
  // ... existing commands
  'my-command': myCommandCmd
};
```

3. Update help message trong `commands/help.ts`

4. Test command:

```bash
npm run cli my-command
```

## Command Parameters

Để thêm parameters cho command, sử dụng `process.argv`:

```typescript
export async function handle() {
  const args = process.argv.slice(3); // Skip 'node', 'cli.ts', 'command'
  const param1 = args[0];
  const param2 = args[1];
  
  console.log(`Param1: ${param1}, Param2: ${param2}`);
}
```

Usage:
```bash
npm run cli my-command value1 value2
```
