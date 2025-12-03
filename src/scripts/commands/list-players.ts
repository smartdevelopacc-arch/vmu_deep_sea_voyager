import { getAvailablePlayers } from '../../core/playerImporter';

export async function handle() {
  const players = await getAvailablePlayers();
  
  console.log(`\n📋 Players in database (${players.length}):\n`);
  
  if (players.length === 0) {
    console.log('   No players found. Run: npm run cli import-players');
  } else {
    players.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.code}`);
      console.log(`      Name: ${p.name}`);
      console.log(`      Slogan: ${p.slogan}`);
      console.log(`      Logo: ${p.logo || '(none)'}`);
      console.log('');
    });
  }
}
