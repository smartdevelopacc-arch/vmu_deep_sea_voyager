<template>
  <div class="map-editor">
    <h1>🗺️ Map Editor</h1>
    
    <div v-if="loading" class="loading">Loading game data...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    
    <div v-else-if="!gameId" class="no-game">
      <p>No game selected. Please select a game to edit.</p>
      <router-link to="/games" class="btn btn-primary">Go to Games</router-link>
    </div>
    
    <div v-else-if="mapData && editedMap" class="editor-container">
      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-section">
          <h3>{{ currentGame?.name || gameId }}</h3>
          <span class="map-size">{{ mapData?.width }} × {{ mapData?.height }}</span>
        </div>
        
        <div class="toolbar-section">
          <label>Tool:</label>
          <select v-model="selectedTool" class="tool-select">
            <option value="view">👁️ View</option>
            <option value="treasure">💎 Add Treasure</option>
            <option value="island">🏝️ Add Island</option>
            <option value="base">🏠 Set Base</option>
            <option value="trap">🪤 Set Trap</option>
            <option value="remove">🗑️ Remove</option>
            <option value="wave">🌊 Set Wave</option>
          </select>
        </div>
        
        <div class="toolbar-section" v-if="selectedTool === 'treasure'">
          <label>Treasure Value:</label>
          <input type="number" v-model.number="treasureValue" min="1" max="100" class="value-input" />
        </div>
        
        <div class="toolbar-section" v-if="selectedTool === 'base'">
          <label>Player Index:</label>
          <select v-model.number="selectedPlayerIndex" class="tool-select">
            <option v-for="i in maxPlayers" :key="i" :value="i-1">Player {{ i }}</option>
          </select>
        </div>
        
        <div class="toolbar-section" v-if="selectedTool === 'trap'">
          <label>Player:</label>
          <select v-model.number="selectedPlayerIndex" class="tool-select">
            <option v-for="i in maxPlayers" :key="i" :value="i-1">Player {{ i }}</option>
          </select>
          <label>Danger:</label>
          <input type="number" v-model.number="trapDanger" min="1" max="10" class="value-input" />
        </div>
        
        <div class="toolbar-section" v-if="selectedTool === 'wave'">
          <label>Wave Level:</label>
          <input type="number" v-model.number="waveLevel" min="0" max="5" class="value-input" />
        </div>
        
        <div class="toolbar-section actions">
          <button @click="saveChanges" class="btn btn-success" :disabled="!hasChanges">
            💾 Save Changes
          </button>
          <button @click="resetChanges" class="btn btn-secondary" :disabled="!hasChanges">
            ↩️ Reset
          </button>
          <router-link :to="`/games/${gameId}/control`" class="btn btn-primary">
            ← Back to Game
          </router-link>
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
              <!-- Trap with colored circle -->
              <div v-if="getTrapAtPosition(x-1, y-1)" class="trap-indicator"
                   :style="{ backgroundColor: getTrapColor(x-1, y-1) }">
                <span class="trap-emoji">🪤</span>
                <span class="trap-danger">{{ getTrapAtPosition(x-1, y-1).danger }}</span>
              </div>
              <!-- Regular content -->
              <span v-else class="cell-content">{{ getCellContent(x-1, y-1) }}</span>
              <span v-if="editedMap?.treasures?.[y-1]?.[x-1] > 0" class="treasure-value">
                {{ editedMap.treasures[y-1][x-1] }}
              </span>
              <span v-if="editedMap?.waves?.[y-1]?.[x-1] > 0" class="wave-value">
                {{ editedMap.waves[y-1][x-1] }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Legend & Stats -->
      <div class="editor-info">
        <div class="legend">
          <h3>Legend</h3>
          <div class="legend-items">
            <div class="legend-item"><span class="icon">🏠</span> Base</div>
            <div class="legend-item"><span class="icon">💎</span> Treasure</div>
            <div class="legend-item"><span class="icon">🏝️</span> Island</div>
            <div class="legend-item"><span class="icon">🪤</span> Trap</div>
            <div class="legend-item"><span class="icon">🌊</span> Wave</div>
          </div>
        </div>
        
        <div class="stats">
          <h3>Map Statistics</h3>
          <div class="stat-item">
            <label>Total Treasures:</label>
            <span>{{ totalTreasures }}</span>
          </div>
          <div class="stat-item">
            <label>Total Islands:</label>
            <span>{{ totalIslands }}</span>
          </div>
          <div class="stat-item">
            <label>Total Bases:</label>
            <span>{{ totalBases }}</span>
          </div>
          <div class="stat-item">
            <label>Total Traps:</label>
            <span>{{ totalTraps }}</span>
          </div>
          <div class="stat-item">
            <label>Changes Made:</label>
            <span>{{ changeCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import apiClient from '../api/client'

const route = useRoute()
const gameStore = useGameStore()

const gameId = ref<string>(route.params.id as string)
const loading = ref(false)
const error = ref<string | null>(null)

const selectedTool = ref('view')
const treasureValue = ref(10)
const waveLevel = ref(1)
const selectedPlayerIndex = ref(0)
const trapDanger = ref(5)
const maxPlayers = ref(4)

const mapData = ref<any>(null)
const editedMap = ref<any>(null)
const currentGame = computed(() => gameStore.currentGame)

// Player colors matching MapViewer
const PLAYER_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#a855f7']

const getPlayerColor = (playerIndex: number) => {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] || '#666'
}

const getTrapAtPosition = (x: number, y: number) => {
  if (!editedMap.value?.traps) return null
  return editedMap.value.traps.find((t: any) => {
    const tx = t.position?.x ?? t[0]
    const ty = t.position?.y ?? t[1]
    return tx === x && ty === y
  })
}

const getTrapColor = (x: number, y: number) => {
  const trap = getTrapAtPosition(x, y)
  if (!trap) return '#666'
  
  const playerId = trap.playerId || trap[3] || ''
  // Extract player index from playerId (format: "player_0", "player_1", etc)
  const match = playerId.match(/player_(\d+)/)
  if (match) {
    return getPlayerColor(parseInt(match[1]))
  }
  return '#666'
}

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${mapData.value?.width || 10}, 1fr)`,
  gridTemplateRows: `repeat(${mapData.value?.height || 10}, 1fr)`
}))

const hasChanges = computed(() => {
  if (!mapData.value || !editedMap.value) return false
  return JSON.stringify(mapData.value) !== JSON.stringify(editedMap.value)
})

const changeCount = computed(() => {
  if (!hasChanges.value) return 0
  let count = 0
  
  // Count treasure changes
  for (let y = 0; y < mapData.value.height; y++) {
    for (let x = 0; x < mapData.value.width; x++) {
      const original = mapData.value.treasures?.[y]?.[x] || 0
      const edited = editedMap.value.treasures?.[y]?.[x] || 0
      if (original !== edited) count++
    }
  }
  
  // Count terrain changes
  for (let y = 0; y < mapData.value.height; y++) {
    for (let x = 0; x < mapData.value.width; x++) {
      const original = mapData.value.terrain?.[y]?.[x] || 0
      const edited = editedMap.value.terrain?.[y]?.[x] || 0
      if (original !== edited) count++
    }
  }
  
  return count
})

const totalTreasures = computed(() => {
  if (!editedMap.value?.treasures) return 0
  let total = 0
  editedMap.value.treasures.forEach((row: number[]) => {
    row.forEach((val: number) => {
      if (val > 0) total += val
    })
  })
  return total
})

const totalIslands = computed(() => {
  if (!editedMap.value?.terrain) return 0
  let count = 0
  editedMap.value.terrain.forEach((row: number[]) => {
    row.forEach((val: number) => {
      if (val === -1) count++
    })
  })
  return count
})

const totalBases = computed(() => {
  return editedMap.value?.bases?.length || 0
})

const totalTraps = computed(() => {
  return editedMap.value?.traps?.length || 0
})

const fetchMapData = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await apiClient.get(`/game/${gameId.value}/config`)
    const config = response.data
    
    mapData.value = {
      width: config.width,
      height: config.height,
      terrain: config.terrain || [],
      treasures: config.treasures || [],
      waves: config.waves || [],
      bases: config.bases || [],
      traps: config.traps || []
    }
    
    // Deep clone for editing
    editedMap.value = JSON.parse(JSON.stringify(mapData.value))
    
    // Ensure arrays are initialized
    if (!editedMap.value.treasures || editedMap.value.treasures.length === 0) {
      editedMap.value.treasures = Array(mapData.value.height).fill(0).map(() => 
        Array(mapData.value.width).fill(0)
      )
    }
    
    if (!editedMap.value.terrain || editedMap.value.terrain.length === 0) {
      editedMap.value.terrain = Array(mapData.value.height).fill(0).map(() => 
        Array(mapData.value.width).fill(0)
      )
    }
    
    if (!editedMap.value.waves || editedMap.value.waves.length === 0) {
      editedMap.value.waves = Array(mapData.value.height).fill(0).map(() => 
        Array(mapData.value.width).fill(0)
      )
    }
    
    if (!editedMap.value.bases) {
      editedMap.value.bases = []
    }
    
    if (!editedMap.value.traps) {
      editedMap.value.traps = []
    }
    
    await gameStore.fetchGameState(gameId.value)
  } catch (err: any) {
    error.value = err.message
    console.error('Failed to fetch map data:', err)
  } finally {
    loading.value = false
  }
}

const handleCellClick = (x: number, y: number) => {
  if (selectedTool.value === 'view') return
  
  if (selectedTool.value === 'treasure') {
    if (!editedMap.value.treasures[y]) {
      editedMap.value.treasures[y] = Array(mapData.value.width).fill(0)
    }
    editedMap.value.treasures[y][x] = treasureValue.value
  } else if (selectedTool.value === 'island') {
    if (!editedMap.value.terrain[y]) {
      editedMap.value.terrain[y] = Array(mapData.value.width).fill(0)
    }
    editedMap.value.terrain[y][x] = -1
  } else if (selectedTool.value === 'base') {
    // Ensure bases array is initialized
    if (!editedMap.value.bases) {
      editedMap.value.bases = []
    }
    // Remove existing base for this player index
    editedMap.value.bases = editedMap.value.bases.filter((_: any, idx: number) => 
      idx !== selectedPlayerIndex.value
    )
    // Add new base at selected position
    while (editedMap.value.bases.length <= selectedPlayerIndex.value) {
      editedMap.value.bases.push({ x: 0, y: 0 })
    }
    editedMap.value.bases[selectedPlayerIndex.value] = { x, y }
  } else if (selectedTool.value === 'trap') {
    // Ensure traps array is initialized
    if (!editedMap.value.traps) {
      editedMap.value.traps = []
    }
    // Remove existing trap at this position
    editedMap.value.traps = editedMap.value.traps.filter((t: any) => {
      const tx = t.position?.x ?? t[0]
      const ty = t.position?.y ?? t[1]
      return !(tx === x && ty === y)
    })
    // Add new trap
    editedMap.value.traps.push({
      position: { x, y },
      danger: trapDanger.value,
      playerId: `player_${selectedPlayerIndex.value}`
    })
  } else if (selectedTool.value === 'remove') {
    // Remove treasure
    if (editedMap.value.treasures[y]) {
      editedMap.value.treasures[y][x] = 0
    }
    // Remove island
    if (editedMap.value.terrain[y]) {
      editedMap.value.terrain[y][x] = 0
    }
    // Remove base at this position
    if (editedMap.value.bases) {
      editedMap.value.bases = editedMap.value.bases.filter((b: any) => {
        const bx = b.x ?? b[0]
        const by = b.y ?? b[1]
        return !(bx === x && by === y)
      })
    }
    // Remove trap at this position
    if (editedMap.value.traps) {
      editedMap.value.traps = editedMap.value.traps.filter((t: any) => {
        const tx = t.position?.x ?? t[0]
        const ty = t.position?.y ?? t[1]
        return !(tx === x && ty === y)
      })
    }
  } else if (selectedTool.value === 'wave') {
    if (!editedMap.value.waves[y]) {
      editedMap.value.waves[y] = Array(mapData.value.width).fill(0)
    }
    editedMap.value.waves[y][x] = waveLevel.value
  }
}

const getCellClass = (x: number, y: number) => {
  const classes = []
  if (editedMap.value?.terrain?.[y]?.[x] === -1) {
    classes.push('island')
  }
  return classes.join(' ')
}

const getCellStyle = (x: number, y: number) => {
  // Check if this is a base
  if (editedMap.value?.bases) {
    const isBase = editedMap.value.bases.some((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    if (isBase) {
      return { backgroundColor: 'rgba(255, 215, 0, 0.3)' }
    }
  }
  
  const wave = editedMap.value?.waves?.[y]?.[x] || 0
  const opacity = 0.1 + (wave / 5) * 0.5
  return { backgroundColor: `rgba(59, 130, 246, ${opacity})` }
}

const getCellContent = (x: number, y: number) => {
  // Base (traps are handled separately in trap-indicator)
  if (editedMap.value?.bases) {
    const isBase = editedMap.value.bases.some((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    if (isBase) return '🏠'
  }
  
  if (editedMap.value?.treasures?.[y]?.[x] > 0) return '💎'
  if (editedMap.value?.terrain?.[y]?.[x] === -1) return '🏝️'
  
  return ''
}

const getCellTitle = (x: number, y: number) => {
  const parts = [`(${x}, ${y})`]
  
  // Check for trap
  if (editedMap.value?.traps) {
    const trap = editedMap.value.traps.find((t: any) => {
      const tx = t.position?.x ?? t[0]
      const ty = t.position?.y ?? t[1]
      return tx === x && ty === y
    })
    if (trap) {
      const danger = trap.danger ?? trap[2]
      const playerId = trap.playerId ?? trap[3] ?? 'Unknown'
      parts.push(`Trap (Danger: ${danger}, Player: ${playerId})`)
    }
  }
  
  // Check for base
  if (editedMap.value?.bases) {
    const baseIndex = editedMap.value.bases.findIndex((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    if (baseIndex >= 0) parts.push(`Base (Player ${baseIndex + 1})`)
  }
  
  const wave = editedMap.value?.waves?.[y]?.[x]
  if (wave) parts.push(`Wave: ${wave}`)
  
  const treasure = editedMap.value?.treasures?.[y]?.[x]
  if (treasure) parts.push(`Treasure: ${treasure}`)
  
  const terrain = editedMap.value?.terrain?.[y]?.[x]
  if (terrain === -1) parts.push('Island')
  
  return parts.join(' | ')
}

const saveChanges = async () => {
  if (!hasChanges.value) return
  
  loading.value = true
  error.value = null
  
  try {
    // Update map config via API
    await apiClient.put(`/game/${gameId.value}/map`, {
      terrain: editedMap.value.terrain,
      waves: editedMap.value.waves,
      treasures: editedMap.value.treasures,
      bases: editedMap.value.bases,
      traps: editedMap.value.traps
    })
    
    // Refresh data
    await fetchMapData()
    
    alert('Map changes saved successfully!')
  } catch (err: any) {
    error.value = `Failed to save: ${err.message}`
    alert(`Failed to save: ${err.message}`)
    console.error('Failed to save map changes:', err)
  } finally {
    loading.value = false
  }
}

const resetChanges = () => {
  if (confirm('Are you sure you want to discard all changes?')) {
    editedMap.value = JSON.parse(JSON.stringify(mapData.value))
  }
}

onMounted(() => {
  if (gameId.value) {
    fetchMapData()
  }
})
</script>

<style scoped>
.map-editor {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.loading, .error, .no-game {
  text-align: center;
  padding: 40px;
}

.error {
  color: #ef4444;
}

.no-game {
  color: #666;
}

.editor-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  align-items: center;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-section h3 {
  margin: 0;
  font-size: 18px;
}

.map-size {
  color: #666;
  font-size: 14px;
}

.toolbar-section label {
  font-weight: 600;
  font-size: 14px;
}

.tool-select, .value-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.value-input {
  width: 80px;
}

.actions {
  margin-left: auto;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn:not(:disabled):hover {
  opacity: 0.9;
}

.map-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.map-grid {
  display: grid;
  gap: 1px;
  background: #ddd;
  border: 2px solid #999;
  aspect-ratio: 1;
  width: 100%;
  max-width: 800px;
  max-height: 800px;
  margin: 0 auto;
}

.map-row {
  display: contents;
}

.map-cell {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  position: relative;
  cursor: pointer;
  transition: transform 0.1s, box-shadow 0.1s;
  font-size: clamp(10px, 1.5vw, 20px);
}

.map-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 0 8px rgba(0,0,0,0.3);
}

.map-cell.island {
  background: #d4a574 !important;
}

.cell-content {
  font-size: 1.5em;
  line-height: 1;
}

.treasure-value, .wave-value {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 0.7em;
  font-weight: bold;
  color: white;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  padding: 1px 4px;
  min-width: 16px;
  text-align: center;
}

.treasure-value {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.wave-value {
  background: rgba(59, 130, 246, 0.8);
  left: 2px;
  right: auto;
}

.trap-indicator {
  width: 80%;
  height: 80%;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  border: 2px solid rgba(255,255,255,0.3);
  position: relative;
}

.trap-emoji {
  font-size: 1.2em;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.trap-danger {
  font-size: 0.6em;
  position: absolute;
  bottom: 2px;
  background: rgba(0,0,0,0.6);
  border-radius: 8px;
  padding: 1px 4px;
  min-width: 14px;
  text-align: center;
}

.editor-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.legend, .stats {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.legend h3, .stats h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
}

.legend-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.legend-item .icon {
  font-size: 20px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-item label {
  font-weight: 600;
  color: #666;
}

.stat-item span {
  font-weight: bold;
  color: #333;
}
</style>
