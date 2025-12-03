import { importPlayers } from '../../core/playerImporter';

export async function handle() {
  console.log('🔄 Importing players from assets/players/ directory...\n');
  await importPlayers();
  console.log('\n✅ Import completed');
}
