import { GameModel } from '../../models/game.model';

export async function handle() {
  try {
    console.log('🔧 Dropping players.code_1 index from games collection...');
    
    const collection = GameModel.collection;
    
    // List all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    // Drop the problematic index if it exists
    try {
      await collection.dropIndex('players.code_1');
      console.log('✅ Successfully dropped players.code_1 index');
    } catch (err: any) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  Index players.code_1 does not exist (already dropped or never created)');
      } else {
        throw err;
      }
    }
    
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}
