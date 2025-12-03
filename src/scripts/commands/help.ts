export async function handle() {
  console.log(`
🎮 Deep Sea Voyager - CLI Management Tool

Available commands:

  import-players    Import players from assets/players/ directory to database
  reset-db          Clear all game data (preserves players)
  reset-all         Clear everything including players
  list-players      Show all players in database
  list-games        Show all games in database
  drop-player-index Drop problematic players.code_1 index from games collection
  help              Show this help message

Usage:
  npm run cli <command>

Examples:
  npm run cli import-players
  npm run cli reset-db
  npm run cli list-players
  npm run cli drop-player-index
`);
}
