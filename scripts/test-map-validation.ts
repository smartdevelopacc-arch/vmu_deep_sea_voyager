/**
 * Test Map Validation Script
 * 
 * Test cases:
 * 1. Treasure on island (should fail)
 * 2. Island on base (should fail)
 * 3. Valid map (should pass)
 */

interface MapData {
  width: number;
  height: number;
  terrain: number[][];
  treasures: number[][];
  bases: number[][];
}

interface MapFile {
  name: string;
  mapData: MapData;
}

/**
 * Validate map data for logical consistency
 */
function validateMapData(mapData: MapData, mapCode: string): string[] {
  const errors: string[] = [];
  const { width, height, terrain, treasures, bases } = mapData;

  // Convert bases to coordinate array for easier checking
  const baseCoords = bases.map(b => Array.isArray(b) ? { x: b[0], y: b[1] } : b);

  // Check each cell
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const terrainValue = terrain[y]?.[x];
      const treasureValue = treasures[y]?.[x];
      
      // Rule 1: Treasure cannot be placed on island (terrain = -1)
      if (terrainValue === -1 && treasureValue && treasureValue > 0) {
        errors.push(`Treasure (value=${treasureValue}) at (${x}, ${y}) is on an island (terrain=-1)`);
      }
      
      // Rule 2: Island cannot be placed on base
      if (terrainValue === -1) {
        const isBase = baseCoords.some(base => base.x === x && base.y === y);
        if (isBase) {
          errors.push(`Island (terrain=-1) at (${x}, ${y}) is on a base position`);
        }
      }
    }
  }

  return errors;
}

// Test Case 1: Treasure on island (should fail)
console.log('🧪 Test 1: Treasure on island (should FAIL)');
const testMap1: MapFile = {
  name: 'Test Map 1 - Invalid',
  mapData: {
    width: 5,
    height: 5,
    terrain: [
      [0, 0, 0, 0, 0],
      [0, 0, -1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    treasures: [
      [0, 0, 0, 0, 0],
      [0, 0, 50, 0, 0], // Treasure on island at (2, 1)
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    bases: [[0, 0], [4, 4]]
  }
};

const errors1 = validateMapData(testMap1.mapData, 'test1');
if (errors1.length > 0) {
  console.log('✅ PASS - Validation caught errors:');
  errors1.forEach(err => console.log(`   - ${err}`));
} else {
  console.log('❌ FAIL - Should have detected treasure on island');
}

// Test Case 2: Island on base (should fail)
console.log('\n🧪 Test 2: Island on base (should FAIL)');
const testMap2: MapFile = {
  name: 'Test Map 2 - Invalid',
  mapData: {
    width: 5,
    height: 5,
    terrain: [
      [-1, 0, 0, 0, 0], // Island on base at (0, 0)
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, -1] // Island on base at (4, 4)
    ],
    treasures: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 50, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    bases: [[0, 0], [4, 4]]
  }
};

const errors2 = validateMapData(testMap2.mapData, 'test2');
if (errors2.length > 0) {
  console.log('✅ PASS - Validation caught errors:');
  errors2.forEach(err => console.log(`   - ${err}`));
} else {
  console.log('❌ FAIL - Should have detected islands on bases');
}

// Test Case 3: Valid map (should pass)
console.log('\n🧪 Test 3: Valid map (should PASS)');
const testMap3: MapFile = {
  name: 'Test Map 3 - Valid',
  mapData: {
    width: 5,
    height: 5,
    terrain: [
      [0, 0, 0, 0, 0],
      [0, 0, -1, 0, 0], // Island not on base or treasure
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    treasures: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 50, 0, 0], // Treasure not on island
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    bases: [[0, 0], [4, 4]]
  }
};

const errors3 = validateMapData(testMap3.mapData, 'test3');
if (errors3.length === 0) {
  console.log('✅ PASS - No errors detected (as expected)');
} else {
  console.log('❌ FAIL - Should not have detected any errors:');
  errors3.forEach(err => console.log(`   - ${err}`));
}

// Test Case 4: Both errors (should fail with 2 errors)
console.log('\n🧪 Test 4: Multiple errors (should FAIL with 2+ errors)');
const testMap4: MapFile = {
  name: 'Test Map 4 - Multiple Errors',
  mapData: {
    width: 5,
    height: 5,
    terrain: [
      [-1, 0, 0, 0, 0], // Island on base at (0, 0)
      [0, 0, -1, 0, 0], // Island at (2, 1)
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    treasures: [
      [0, 0, 0, 0, 0],
      [0, 0, 100, 0, 0], // Treasure on island at (2, 1)
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ],
    bases: [[0, 0], [4, 4]]
  }
};

const errors4 = validateMapData(testMap4.mapData, 'test4');
if (errors4.length >= 2) {
  console.log(`✅ PASS - Validation caught ${errors4.length} errors:`);
  errors4.forEach(err => console.log(`   - ${err}`));
} else {
  console.log(`❌ FAIL - Should have detected at least 2 errors, found ${errors4.length}`);
  errors4.forEach(err => console.log(`   - ${err}`));
}

console.log('\n✅ All tests completed!');
