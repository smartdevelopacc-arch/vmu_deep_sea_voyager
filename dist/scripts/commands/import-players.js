"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle = handle;
const playerImporter_1 = require("../../core/playerImporter");
async function handle() {
    console.log('🔄 Importing players from assets/players/ directory...\n');
    await (0, playerImporter_1.importPlayers)();
    console.log('\n✅ Import completed');
}
