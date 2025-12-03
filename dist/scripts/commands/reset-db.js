"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const game_model_1 = require("../../models/game.model");
const playerAction_model_1 = require("../../models/playerAction.model");
async function handle() {
    console.log('⚠️  This will delete all games and player actions (but keep players)');
    console.log('🔄 Clearing game data...\n');
    const gamesDeleted = await game_model_1.GameModel.deleteMany({});
    const actionsDeleted = await playerAction_model_1.PlayerActionModel.deleteMany({});
    console.log(`✅ Deleted ${gamesDeleted.deletedCount} games`);
    console.log(`✅ Deleted ${actionsDeleted.deletedCount} player actions`);
    console.log('\n✅ Database reset completed (players preserved)');
}
