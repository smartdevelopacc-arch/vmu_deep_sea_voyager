import { connectDB } from '../src/core/db';
import { Player } from '../src/models/player.model';
import fs from 'fs';
import path from 'path';

/**
 * Test player secret import logic
 * 
 * Test cases:
 * 1. Import player WITH player_secret in JSON → should UPDATE secret in DB
 * 2. Import player WITHOUT player_secret in JSON → should KEEP existing secret
 * 3. Import NEW player WITHOUT player_secret → should GENERATE new secret
 */

async function testPlayerSecretImport() {
  console.log('🧪 Testing player secret import logic...\n');

  await connectDB();

  // Prepare test data
  const testPlayerCode = 'test_secret_player';
  const playersDir = path.join(__dirname, '../assets/players');
  const testFilePath = path.join(playersDir, `${testPlayerCode}.json`);

  try {
    // === Test 1: Create new player WITHOUT player_secret in JSON ===
    console.log('=== Test 1: New player WITHOUT player_secret ===');
    
    // Clean up if exists
    await Player.deleteOne({ code: testPlayerCode });

    // Create JSON WITHOUT player_secret
    const jsonWithoutSecret = {
      name: 'Test Secret Player',
      slogan: 'Testing secret logic',
      logo: 'test-logo-base64'
    };
    fs.writeFileSync(testFilePath, JSON.stringify(jsonWithoutSecret, null, 2));

    // Import
    const { importPlayers } = await import('../src/core/playerImporter');
    await importPlayers();

    // Check DB
    let player = await Player.findOne({ code: testPlayerCode });
    const generatedSecret = player?.secret;
    console.log(`✅ Generated secret: ${generatedSecret}`);
    console.log(`   Expected: Auto-generated 5-char string`);
    console.log(`   Result: ${generatedSecret && generatedSecret.length === 5 ? 'PASS ✓' : 'FAIL ✗'}\n`);

    // === Test 2: Re-import WITHOUT player_secret → should KEEP existing secret ===
    console.log('=== Test 2: Re-import WITHOUT player_secret (should KEEP existing) ===');
    
    // Re-import same JSON (no player_secret)
    await importPlayers();

    // Check DB
    player = await Player.findOne({ code: testPlayerCode });
    const keptSecret = player?.secret;
    console.log(`✅ Secret after re-import: ${keptSecret}`);
    console.log(`   Expected: ${generatedSecret} (same as before)`);
    console.log(`   Result: ${keptSecret === generatedSecret ? 'PASS ✓' : 'FAIL ✗'}\n`);

    // === Test 3: Import WITH player_secret → should OVERWRITE ===
    console.log('=== Test 3: Import WITH player_secret (should OVERWRITE) ===');
    
    const newSecret = 'ABC99';
    const jsonWithSecret = {
      name: 'Test Secret Player',
      slogan: 'Testing secret logic',
      logo: 'test-logo-base64',
      player_secret: newSecret
    };
    fs.writeFileSync(testFilePath, JSON.stringify(jsonWithSecret, null, 2));

    // Import
    await importPlayers();

    // Check DB
    player = await Player.findOne({ code: testPlayerCode });
    const overwrittenSecret = player?.secret;
    console.log(`✅ Secret after import with player_secret: ${overwrittenSecret}`);
    console.log(`   Expected: ${newSecret}`);
    console.log(`   Result: ${overwrittenSecret === newSecret ? 'PASS ✓' : 'FAIL ✗'}\n`);

    // === Test 4: Re-import WITH different player_secret → should UPDATE ===
    console.log('=== Test 4: Re-import WITH different player_secret (should UPDATE) ===');
    
    const anotherSecret = 'XYZ77';
    jsonWithSecret.player_secret = anotherSecret;
    fs.writeFileSync(testFilePath, JSON.stringify(jsonWithSecret, null, 2));

    // Import
    await importPlayers();

    // Check DB
    player = await Player.findOne({ code: testPlayerCode });
    const updatedSecret = player?.secret;
    console.log(`✅ Secret after second import: ${updatedSecret}`);
    console.log(`   Expected: ${anotherSecret}`);
    console.log(`   Result: ${updatedSecret === anotherSecret ? 'PASS ✓' : 'FAIL ✗'}\n`);

    // === Summary ===
    console.log('=== Test Summary ===');
    const allPassed = 
      generatedSecret && generatedSecret.length === 5 &&
      keptSecret === generatedSecret &&
      overwrittenSecret === newSecret &&
      updatedSecret === anotherSecret;

    if (allPassed) {
      console.log('🎉 All tests PASSED!');
      console.log('\nConclusion:');
      console.log('✅ New player without secret → auto-generated');
      console.log('✅ Re-import without secret → keeps existing');
      console.log('✅ Import with secret → overwrites');
      console.log('✅ Re-import with different secret → updates');
    } else {
      console.log('❌ Some tests FAILED!');
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    // Clean up
    await Player.deleteOne({ code: testPlayerCode });
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    console.log('\n🧹 Cleanup completed');
    process.exit(0);
  }
}

testPlayerSecretImport().catch(console.error);
