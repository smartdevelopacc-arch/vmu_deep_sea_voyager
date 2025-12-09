<template>
  <div class="map-content-editor">
    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-section">
        <span class="map-size">{{ mapData.width }} × {{ mapData.height }}</span>
      </div>
      
      <div class="toolbar-section">
        <label>Tool:</label>
        <select v-model="selectedTool" class="tool-select">
          <option value="view">👁️ View</option>
          <option value="treasure">💎 Add Treasure</option>
          <option value="island">🏝️ Add Island</option>
          <option value="base">🏠 Set Base</option>
          <option value="remove">🗑️ Remove</option>
          <option value="wave">🌊 Set Wave</option>
        </select>
      </div>
      
      <div class="toolbar-section" v-if="selectedTool === 'treasure'">
        <label>Treasure Value:</label>
        <input type="number" v-model.number="treasureValue" min="1" max="100" class="value-input" />
      </div>
      
      <div class="toolbar-section" v-if="selectedTool === 'base'">
        <label>Base Index:</label>
        <input type="number" v-model.number="selectedBaseIndex" min="0" :max="3" class="value-input" />
      </div>
      
      <div class="toolbar-section" v-if="selectedTool === 'wave'">
        <label>Wave Level:</label>
        <input type="number" v-model.number="waveLevel" min="0" max="5" class="value-input" />
      </div>
      
      <div class="toolbar-section stats">
        <span>💎 Treasures: {{ totalTreasures }}</span>
        <span>🏝️ Islands: {{ totalIslands }}</span>
        <span>🏠 Bases: {{ totalBases }}</span>
      </div>
      
      <div class="toolbar-section actions">
        <button @click="saveChanges" class="btn btn-success" :disabled="!hasChanges">
          💾 Save ({{ changeCount }})
        </button>
        <button @click="resetChanges" class="btn btn-secondary" :disabled="!hasChanges">
          ↩️ Reset
        </button>
      </div>
    </div>
    
    <!-- Map Grid -->
    <div class="map-container">
      <div class="map-grid" :style="gridStyle">
                <div 
                  v-for="y in mapData.height" 
                  :key="`row-${y-1}`"
                  class="map-row"
                >
                  <div 
                    v-for="x in mapData.width" 
                    :key="`cell-${y-1}-${x-1}`"
                    class="map-cell"
                    :class="getCellClass(x-1, y-1)"
                    :style="getCellStyle(x-1, y-1)"
                    @click="handleCellClick(x-1, y-1)"
                    :title="getCellTitle(x-1, y-1)"
                  >
                    <!-- Base indicator -->
                    <div v-if="getBaseAtPosition(x-1, y-1) !== null" class="base-indicator">
                      <span class="base-emoji">🏠</span>
                      <span class="base-index">{{ getBaseAtPosition(x-1, y-1) }}</span>
                    </div>
                    <!-- Treasure -->
                    <div v-else-if="getTreasureValue(x-1, y-1) > 0" class="treasure-container">
                      <span class="cell-content">💎</span>
                      <span class="treasure-value">{{ getTreasureValue(x-1, y-1) }}</span>
                    </div>
                    <!-- Island -->
                    <span v-else-if="getTerrainValue(x-1, y-1) === -1" class="cell-content">🏝️</span>
                    <!-- Wave level -->
                    <span v-else class="wave-level">{{ getWaveValue(x-1, y-1) }}</span>
                  </div>
                </div>
              </div>
            </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface MapData {
  width: number
  height: number
  terrain: number[][]
  treasures: number[][]
  waves?: number[][]
  bases: number[][]
}

const makeGrid = (grid: number[][] | undefined, width: number, height: number, fill: number) => {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => grid?.[y]?.[x] ?? fill)
  )
}

const normalizeMap = (map: MapData): MapData => ({
  ...map,
  terrain: makeGrid(map.terrain, map.width, map.height, 0),
  treasures: makeGrid(map.treasures, map.width, map.height, 0),
  waves: makeGrid(map.waves, map.width, map.height, 2),
  bases: map.bases || []
})

const props = defineProps<{
  mapData: MapData
}>()

const emit = defineEmits<{
  save: [mapData: MapData]
}>()

// Editor state
const selectedTool = ref('view')
const treasureValue = ref(50)
const selectedBaseIndex = ref(0)
const waveLevel = ref(2)

// Edited map state
const editedMap = ref<MapData>(normalizeMap(props.mapData))

// Watch for external changes to mapData
watch(() => props.mapData, (newData) => {
  editedMap.value = normalizeMap(newData)
}, { deep: true })

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.mapData.width || 10}, 1fr)`,
  gridTemplateRows: `repeat(${props.mapData.height || 10}, 1fr)`
}))

const hasChanges = computed(() => {
  return JSON.stringify(props.mapData) !== JSON.stringify(editedMap.value)
})

const changeCount = computed(() => {
  if (!hasChanges.value) return 0
  let count = 0
  
  // Count all differences
  for (let y = 0; y < props.mapData.height; y++) {
    for (let x = 0; x < props.mapData.width; x++) {
      if ((props.mapData.treasures?.[y]?.[x] || 0) !== (editedMap.value.treasures?.[y]?.[x] || 0)) count++
      if ((props.mapData.terrain?.[y]?.[x] || 0) !== (editedMap.value.terrain?.[y]?.[x] || 0)) count++
      if ((props.mapData.waves?.[y]?.[x] || 0) !== (editedMap.value.waves?.[y]?.[x] || 0)) count++
    }
  }
  
  // Count base changes
  if (JSON.stringify(props.mapData.bases) !== JSON.stringify(editedMap.value.bases)) count += 10
  
  return count
})

// Helpers to safely read grid values
const getTreasureValue = (x: number, y: number) => editedMap.value.treasures?.[y]?.[x] || 0
const getTerrainValue = (x: number, y: number) => editedMap.value.terrain?.[y]?.[x] || 0
const getWaveValue = (x: number, y: number) => editedMap.value.waves?.[y]?.[x] || 0

const totalTreasures = computed(() => {
  if (!editedMap.value.treasures) return 0
  let total = 0
  editedMap.value.treasures.forEach((row: number[]) => {
    row.forEach((val: number) => {
      if (val > 0) total += val
    })
  })
  return total
})

const totalIslands = computed(() => {
  if (!editedMap.value.terrain) return 0
  let count = 0
  editedMap.value.terrain.forEach((row: number[]) => {
    row.forEach((val: number) => {
      if (val === -1) count++
    })
  })
  return count
})

const totalBases = computed(() => {
  return editedMap.value.bases?.length || 0
})

const getBaseAtPosition = (x: number, y: number): number | null => {
  if (!editedMap.value.bases) return null
  const index = editedMap.value.bases.findIndex((base: any) => {
    const bx = Array.isArray(base) ? base[0] : base.x
    const by = Array.isArray(base) ? base[1] : base.y
    return bx === x && by === y
  })
  return index >= 0 ? index : null
}

const handleCellClick = (x: number, y: number) => {
  if (selectedTool.value === 'view') return
  
  // Ensure arrays exist
  if (!editedMap.value.treasures) {
    editedMap.value.treasures = Array(props.mapData.height).fill(0).map(() => 
      Array(props.mapData.width).fill(0)
    )
  }
  if (!editedMap.value.terrain) {
    editedMap.value.terrain = Array(props.mapData.height).fill(0).map(() => 
      Array(props.mapData.width).fill(0)
    )
  }
  if (!editedMap.value.waves) {
    editedMap.value.waves = Array(props.mapData.height).fill(0).map(() => 
      Array(props.mapData.width).fill(2)
    )
  }
  if (!editedMap.value.bases) {
    editedMap.value.bases = []
  }
  
  switch (selectedTool.value) {
    case 'treasure':
      // Set treasure, clear terrain island
      editedMap.value.treasures[y][x] = treasureValue.value
      if (editedMap.value.terrain?.[y]?.[x] === -1) {
        editedMap.value.terrain[y][x] = 0
      }
      break
      
    case 'island':
      // Set island, clear treasure
      editedMap.value.terrain[y][x] = -1
      editedMap.value.treasures[y][x] = 0
      break
      
    case 'base':
      // Add or update base
      const existingIndex = getBaseAtPosition(x, y)
      if (existingIndex !== null) {
        // Remove existing base at this position
        editedMap.value.bases.splice(existingIndex, 1)
      }
      // Check if this base index already exists elsewhere
      const targetIndex = selectedBaseIndex.value
      if (targetIndex < editedMap.value.bases.length) {
        // Update existing base position
        editedMap.value.bases[targetIndex] = [x, y]
      } else {
        // Add new base
        editedMap.value.bases.push([x, y])
      }
      break
      
    case 'wave':
      editedMap.value.waves[y][x] = waveLevel.value
      break
      
    case 'remove':
      // Remove everything at this position
      editedMap.value.treasures[y][x] = 0
      editedMap.value.terrain[y][x] = 0
      // Remove base if exists
      const baseIdx = getBaseAtPosition(x, y)
      if (baseIdx !== null) {
        editedMap.value.bases.splice(baseIdx, 1)
      }
      break
  }
}

const getCellClass = (x: number, y: number) => {
  const classes = []
  if (editedMap.value.terrain?.[y]?.[x] === -1) {
    classes.push('island')
  }
  return classes.join(' ')
}

const getCellStyle = (x: number, y: number) => {
  // Base has special background
  if (getBaseAtPosition(x, y) !== null) {
    return { backgroundColor: 'rgba(255, 215, 0, 0.3)' }
  }
  
  // Wave color intensity
  const wave = editedMap.value.waves?.[y]?.[x] ?? 0
  const opacity = 0.02 + (wave / 5) * 0.93
  return { backgroundColor: `rgba(59, 130, 246, ${opacity})` }
}

const getCellTitle = (x: number, y: number) => {
  const parts = [`(${x}, ${y})`]
  
  const base = getBaseAtPosition(x, y)
  if (base !== null) parts.push(`Base ${base}`)
  
  const treasure = editedMap.value.treasures?.[y]?.[x]
  if (treasure && treasure > 0) parts.push(`Treasure: ${treasure}`)
  
  const terrain = editedMap.value.terrain?.[y]?.[x]
  if (terrain === -1) parts.push('Island')
  
  const wave = editedMap.value.waves?.[y]?.[x]
  if (wave !== undefined) parts.push(`Wave: ${wave}`)
  
  return parts.join(' | ')
}

const saveChanges = () => {
  console.log('💾 Saving map content:', editedMap.value)
  emit('save', JSON.parse(JSON.stringify(editedMap.value)))
}

const resetChanges = () => {
  editedMap.value = JSON.parse(JSON.stringify(props.mapData))
}
</script>

<style scoped>
.map-content-editor {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.toolbar {
  display: flex;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-section {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar-section label {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.tool-select,
.value-input {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
}

.value-input {
  width: 70px;
}

.map-size {
  font-weight: 600;
  color: #6b7280;
  background: white;
  padding: 6px 12px;
  border-radius: 4px;
}

.stats {
  gap: 12px;
  margin-left: auto;
}

.stats span {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
}

.actions {
  gap: 8px;
}

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #16a34a;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.map-container {
  flex: 1;
  overflow: auto;
  background: white;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.map-grid {
  display: grid;
  gap: 1px;
  background: #ddd;
  border: 2px solid #999;
  width: 100%;
  height: 100%;
  max-width: min(800px, 100%);
  max-height: min(800px, 100%);
  aspect-ratio: 1 / 1;
}

.map-row {
  display: contents;
}

.map-cell {
  aspect-ratio: 1 / 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  position: relative;
  cursor: pointer;
  transition: transform 0.1s;
  font-size: clamp(6px, 1vw, 14px);
  border: 1px solid transparent;
  overflow: hidden;
}

.map-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  border-color: #3b82f6;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
}

.map-cell.island {
  background: #a0522d !important;
}

.cell-content {
  font-size: 1.3em;
  line-height: 1;
}

.wave-level {
  font-size: 0.7em;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.8);
}

.base-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.base-emoji {
  font-size: 1.2em;
}

.base-index {
  font-size: 0.6em;
  font-weight: bold;
  background: rgba(255, 215, 0, 0.9);
  color: #000;
  padding: 1px 4px;
  border-radius: 3px;
}

.treasure-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.treasure-value {
  font-size: 0.6em;
  font-weight: bold;
  background: rgba(255, 215, 0, 0.9);
  color: #000;
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
