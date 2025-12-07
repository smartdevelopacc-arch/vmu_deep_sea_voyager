"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
async function handle() {
    console.log(`
🎮 Deep Sea Voyager - CLI Management Tool

Available commands:

  import-players    Import players from assets/players/ directory to database
  import-maps       Import maps from assets/maps/ directory to database
                    Use: npm run cli import-maps [list|-- --force|help]
  reset-db          Clear all game data (preserves players)
  reset-all         Clear everything including players
  list-players      Show all players in database
  list-games        Show all games in database
  drop-player-index Drop problematic players.code_1 index from games collection
  help              Show this help message

Usage:
  npm run cli <command> [options]

Examples:
  npm run cli import-players
  npm run cli import-maps                 # Import maps (skip existing)
  npm run cli import-maps -- --force      # Import maps (overwrite existing)
  npm run cli import-maps list            # List all imported maps
  npm run cli reset-db
  npm run cli list-players
  npm run cli drop-player-index
`);
}
