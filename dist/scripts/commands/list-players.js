"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const playerImporter_1 = require("../../core/playerImporter");
async function handle() {
    const players = await (0, playerImporter_1.getAvailablePlayers)();
    console.log(`\n📋 Players in database (${players.length}):\n`);
    if (players.length === 0) {
        console.log('   No players found. Run: npm run cli import-players');
    }
    else {
        players.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.code}`);
            console.log(`      Name: ${p.name}`);
            console.log(`      Slogan: ${p.slogan}`);
            console.log(`      Logo: ${p.logo || '(none)'}`);
            console.log('');
        });
    }
}
