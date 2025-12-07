#!/usr/bin/env node
/**
 * CLI Management Script for Deep Sea Voyager
 * 
 * Usage:
 *   npm run cli import-players    - Import players from players/ directory
 *   npm run cli import-maps       - Import maps from assets/maps/ directory
 *   npm run cli reset-db          - Clear all game data (keeps players)
 *   npm run cli reset-all         - Clear everything including players
 *   npm run cli list-players      - Show all players in database
 *   npm run cli list-games        - Show all games in database
 */

import 'dotenv/config';
import { connectDB } from '../core/db';
import mongoose from 'mongoose';

// Import command handlers
import * as importPlayersCmd from './commands/import-players';
import * as importMapsCmd from './commands/import-maps';
import * as resetDbCmd from './commands/reset-db';
import * as resetAllCmd from './commands/reset-all';
import * as listPlayersCmd from './commands/list-players';
import * as listGamesCmd from './commands/list-games';
import * as dropPlayerIndexCmd from './commands/drop-player-index';
import * as helpCmd from './commands/help';

const commands = {
  'import-players': importPlayersCmd,
  'import-maps': importMapsCmd,
  'reset-db': resetDbCmd,
  'reset-all': resetAllCmd,
  'list-players': listPlayersCmd,
  'list-games': listGamesCmd,
  'drop-player-index': dropPlayerIndexCmd,
  'help': helpCmd
};

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  if (!command || command === 'help') {
    await helpCmd.handle();
    process.exit(0);
  }
  
  const commandModule = commands[command as keyof typeof commands];
  
  if (!commandModule) {
    console.error(`❌ Unknown command: ${command}`);
    console.log('Run "npm run cli help" to see available commands\n');
    process.exit(1);
  }
  
  try {
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Connected to MongoDB\n');
    
    await commandModule.handle(args);
    
    console.log('\n👋 Done!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
