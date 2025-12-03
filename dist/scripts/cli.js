#!/usr/bin/env node
"use strict";
/**
 * CLI Management Script for Deep Sea Voyager
 *
 * Usage:
 *   npm run cli import-players    - Import players from players/ directory
 *   npm run cli reset-db          - Clear all game data (keeps players)
 *   npm run cli reset-all         - Clear everything including players
 *   npm run cli list-players      - Show all players in database
 *   npm run cli list-games        - Show all games in database
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const db_1 = require("../core/db");
const mongoose_1 = __importDefault(require("mongoose"));
// Import command handlers
const importPlayersCmd = __importStar(require("./commands/import-players"));
const resetDbCmd = __importStar(require("./commands/reset-db"));
const resetAllCmd = __importStar(require("./commands/reset-all"));
const listPlayersCmd = __importStar(require("./commands/list-players"));
const listGamesCmd = __importStar(require("./commands/list-games"));
const dropPlayerIndexCmd = __importStar(require("./commands/drop-player-index"));
const helpCmd = __importStar(require("./commands/help"));
const commands = {
    'import-players': importPlayersCmd,
    'reset-db': resetDbCmd,
    'reset-all': resetAllCmd,
    'list-players': listPlayersCmd,
    'list-games': listGamesCmd,
    'drop-player-index': dropPlayerIndexCmd,
    'help': helpCmd
};
async function main() {
    const command = process.argv[2];
    if (!command || command === 'help') {
        await helpCmd.handle();
        process.exit(0);
    }
    const commandModule = commands[command];
    if (!commandModule) {
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "npm run cli help" to see available commands\n');
        process.exit(1);
    }
    try {
        console.log('🔌 Connecting to database...');
        await (0, db_1.connectDB)();
        console.log('✅ Connected to MongoDB\n');
        await commandModule.handle();
        console.log('\n👋 Done!');
        await mongoose_1.default.connection.close();
        process.exit(0);
    }
    catch (error) {
        console.error('\n❌ Error:', error);
        await mongoose_1.default.connection.close();
        process.exit(1);
    }
}
main();
