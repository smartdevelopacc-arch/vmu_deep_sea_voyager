import { GameModel } from '../../models/game.model';
import { PlayerActionModel } from '../../models/playerAction.model';
import { Player } from '../../models/player.model';
import { Map as MapModel} from '../../models/map.model';

export async function handle() {
  console.log('⚠️  WARNING: This will delete EVERYTHING including players!');
  console.log('🔄 Clearing all data...\n');
  
  const gamesDeleted = await GameModel.deleteMany({});
  const actionsDeleted = await PlayerActionModel.deleteMany({});
  const playersDeleted = await Player.deleteMany({});
  const mapsDeleted = await MapModel.deleteMany({});
  
  console.log(`✅ Deleted ${gamesDeleted.deletedCount} games`);
  console.log(`✅ Deleted ${actionsDeleted.deletedCount} player actions`);
  console.log(`✅ Deleted ${playersDeleted.deletedCount} players`);
  console.log(`✅ Deleted ${mapsDeleted.deletedCount} maps`);
  console.log('\n✅ Full database reset completed');
}
