import { GameModel } from '../../models/game.model';
import { PlayerActionModel } from '../../models/playerAction.model';
import { Player } from '../../models/player.model';

export async function handle() {
  console.log('⚠️  WARNING: This will delete EVERYTHING including players!');
  console.log('🔄 Clearing all data...\n');
  
  const gamesDeleted = await GameModel.deleteMany({});
  const actionsDeleted = await PlayerActionModel.deleteMany({});
  const playersDeleted = await Player.deleteMany({});
  
  console.log(`✅ Deleted ${gamesDeleted.deletedCount} games`);
  console.log(`✅ Deleted ${actionsDeleted.deletedCount} player actions`);
  console.log(`✅ Deleted ${playersDeleted.deletedCount} players`);
  console.log('\n✅ Full database reset completed');
}
