"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const game_model_1 = require("../../models/game.model");
const playerAction_model_1 = require("../../models/playerAction.model");
const player_model_1 = require("../../models/player.model");
async function handle() {
    console.log('⚠️  WARNING: This will delete EVERYTHING including players!');
    console.log('🔄 Clearing all data...\n');
    const gamesDeleted = await game_model_1.GameModel.deleteMany({});
    const actionsDeleted = await playerAction_model_1.PlayerActionModel.deleteMany({});
    const playersDeleted = await player_model_1.Player.deleteMany({});
    console.log(`✅ Deleted ${gamesDeleted.deletedCount} games`);
    console.log(`✅ Deleted ${actionsDeleted.deletedCount} player actions`);
    console.log(`✅ Deleted ${playersDeleted.deletedCount} players`);
    console.log('\n✅ Full database reset completed');
}
