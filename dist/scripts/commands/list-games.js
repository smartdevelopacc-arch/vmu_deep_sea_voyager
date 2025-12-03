"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const game_model_1 = require("../../models/game.model");
async function handle() {
    const games = await game_model_1.GameModel.find({}).select('code name status currentTurn players');
    console.log(`\n🎮 Games in database (${games.length}):\n`);
    if (games.length === 0) {
        console.log('   No games found');
    }
    else {
        games.forEach((g, i) => {
            console.log(`   ${i + 1}. ${g.code} - ${g.name || '(no name)'}`);
            console.log(`      Status: ${g.status}`);
            console.log(`      Turn: ${g.currentTurn}`);
            console.log(`      Players: ${g.players?.length || 0}`);
            console.log('');
        });
    }
}
