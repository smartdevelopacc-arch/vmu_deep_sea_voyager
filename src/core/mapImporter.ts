import fs from 'fs';
import path from 'path';
import { Map } from '../models/map.model';
import { connectDB } from './db';

interface MapFile {
  name: string;
  description?: string;
  gameId: string;
  mapData: {
    width: number;
    height: number;
    settings?: {
      enableTraps?: boolean;
    };
    terrain: number[][];
    waves?: number[][];
    treasures: number[][];
    traps: number[][];
    bases: number[][];
    owners?: string[][] | number[][];
  };
  players?: any[];
}

/**
 * Import maps từ thư mục assets/maps/ vào MongoDB
 * Mỗi map là một file: assets/maps/<map_code>.json
 * 
 * @param options.verbose - Show detailed output (default: true)
 * @param options.skipDuplicates - Skip existing maps (default: true). Set to false to overwrite existing maps
 */
export async function importMaps(options?: { verbose?: boolean; skipDuplicates?: boolean }) {
  const verbose = options?.verbose ?? true;
  const skipDuplicates = options?.skipDuplicates ?? true;

  try {
    await connectDB();

    const mapsDir = path.join(process.cwd(), 'assets', 'maps');

    if (!fs.existsSync(mapsDir)) {
      console.error(`❌ Maps directory not found: ${mapsDir}`);
      return;
    }

    const files = fs.readdirSync(mapsDir).filter((file) => file.endsWith('.json'));

    if (files.length === 0) {
      console.log('ℹ️  No map files found in assets/maps/');
      return;
    }

    console.log(`📍 Found ${files.length} map file(s)\n`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
      const filePath = path.join(mapsDir, file);
      const mapCode = path.basename(file, '.json'); // e.g., "map_so_ket_1"

      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const mapFile: MapFile = JSON.parse(fileContent);

        // Extract map data
        const mapData = mapFile.mapData;
        const mapRecord = {
          code: mapCode,
          name: mapFile.name || mapCode,
          width: mapData.width,
          height: mapData.height,
          disable: false,
          terrain: mapData.terrain,
          treasures: mapData.treasures,
          traps: mapData.traps,
          bases: mapData.bases,
          waves: mapData.waves || Array(mapData.height).fill(null).map(() => Array(mapData.width).fill(2)),
          owners: mapData.owners,
        };

        // Check if map already exists
        const existingMap = await Map.findOne({ code: mapCode });
        if (existingMap) {
          if (skipDuplicates) {
            if (verbose) console.log(`⏭️  Skipped: ${mapCode} (already exists)`);
            skipped++;
            continue;
          } else {
            // Update existing map - use $set to replace all fields
            await Map.updateOne({ code: mapCode }, { $set: mapRecord });
            if (verbose) console.log(`✏️  Updated: ${mapCode}`);
            imported++;
            continue;
          }
        }

        // Create new map
        const newMap = new Map(mapRecord);
        await newMap.save();

        if (verbose) console.log(`✅ Imported: ${mapCode}`);
        imported++;
      } catch (error) {
        console.error(`❌ Error importing ${file}:`, (error as Error).message);
        errors++;
      }
    }

    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Imported: ${imported}`);
    console.log(`   ⏭️  Skipped:  ${skipped}`);
    console.log(`   ❌ Errors:   ${errors}`);
  } catch (error) {
    console.error('❌ Import failed:', (error as Error).message);
    throw error;
  }
}

/**
 * List all maps in the database
 */
export async function listMapsInDB() {
  try {
    await connectDB();
    const maps = await Map.find({}, 'code name width height disable').lean();
    return maps;
  } catch (error) {
    console.error('❌ Error listing maps:', (error as Error).message);
    throw error;
  }
}
