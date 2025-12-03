import { GameModel } from '../../models/game.model';
import { PlayerActionModel } from '../../models/playerAction.model';

export async function handle() {
  console.log('⚠️  This will delete all games and player actions (but keep players)');
  console.log('🔄 Clearing game data...\n');
  
  const gamesDeleted = await GameModel.deleteMany({});
  const actionsDeleted = await PlayerActionModel.deleteMany({});
  
  console.log(`✅ Deleted ${gamesDeleted.deletedCount} games`);
  console.log(`✅ Deleted ${actionsDeleted.deletedCount} player actions`);
  console.log('\n✅ Database reset completed (players preserved)');
}
