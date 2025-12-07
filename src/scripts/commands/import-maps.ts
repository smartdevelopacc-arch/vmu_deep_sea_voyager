import { importMaps, listMapsInDB } from '../../core/mapImporter';

export async function handle(args?: string[]) {
  const subcommand = args?.[0];

  if (subcommand === 'list') {
    console.log('📋 Maps in database:\n');
    const maps = await listMapsInDB();
    if (maps.length === 0) {
      console.log('   (no maps found)');
    } else {
      maps.forEach((map: any) => {
        console.log(`   • ${map.code}`);
        console.log(`     Name: ${map.name}`);
        console.log(`     Size: ${map.width}x${map.height}`);
        console.log(`     Status: ${map.disable ? '❌ disabled' : '✅ enabled'}\n`);
      });
    }
    process.exit(0);
  }

  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    console.log('📖 import-maps command usage:\n');
    console.log('  npm run cli import-maps              Import all maps (skip existing)');
    console.log('  npm run cli import-maps -- --force   Import all maps (overwrite existing)');
    console.log('  npm run cli import-maps list         List all maps in database');
    console.log('  npm run cli import-maps help         Show this help message\n');
    console.log('Note: Use -- before --force when using npm run\n');
    process.exit(0);
  }

  // Check for --force flag to overwrite existing maps
  const forceOverwrite = args?.includes('--force') || args?.includes('-f');
  const skipDuplicates = !forceOverwrite;

  console.log(`🔄 Importing maps from assets/maps/ directory...${forceOverwrite ? ' (OVERWRITE MODE)' : ''}\n`);
  await importMaps({ verbose: true, skipDuplicates });
  console.log('\n✅ Import completed');
}
