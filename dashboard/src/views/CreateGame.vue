<template>
  <div class="create-game">
    <h1>🎮 Create New Game</h1>

    <form @submit.prevent="handleSubmit" class="game-form">
      <div class="form-section">
        <h2>Game Information</h2>
        
        <div class="form-group">
          <label for="gameId">Game ID *</label>
          <input 
            v-model="form.gameId" 
            id="gameId" 
            type="text" 
            placeholder="e.g., game001"
            required
          />
        </div>

        <div class="form-group">
          <label for="gameName">Game Name</label>
          <input 
            v-model="form.gameName" 
            id="gameName" 
            type="text" 
            placeholder="e.g., Battle of the Deep"
          />
        </div>
      </div>

      <div class="form-section">
        <h2>Map Configuration</h2>
        
        <div class="map-tabs">
          <button 
            type="button"
            class="tab-button" 
            :class="{ active: mapConfigMode === 'bank' }"
            @click="switchMapMode('bank')"
          >
            📚 From Map Bank
          </button>
          <button 
            type="button"
            class="tab-button" 
            :class="{ active: mapConfigMode === 'custom' }"
            @click="switchMapMode('custom')"
          >
            ✏️ Custom Size
          </button>
        </div>

        <div v-if="mapConfigMode === 'bank'" class="tab-content">
          <div class="form-group">
            <label>Select Map *</label>
            <select v-model="selectedMapCode" @change="loadMapFromBank">
              <option value="">-- Choose a map --</option>
              <option v-for="map in availableMaps" :key="map.code" :value="map.code">
                {{ map.name }} ({{ map.width }}x{{ map.height }})
              </option>
            </select>
          </div>
          
          <div v-if="selectedMapData" class="map-preview-info">
            <p><strong>{{ selectedMapData.name }}</strong></p>
            <p class="hint">{{ selectedMapData.width }}x{{ selectedMapData.height }} - {{ selectedMapData.description }}</p>
          </div>
        </div>

        <div v-if="mapConfigMode === 'custom'" class="tab-content">
          <div class="form-group">
            <label>Map Template</label>
            <select v-model="selectedTemplate" @change="applyTemplate">
              <option value="">Custom (Manual)</option>
              <option value="small">Small (30x30)</option>
              <option value="medium">Medium (40x40)</option>
              <option value="large">Large (50x50)</option>
              <option value="extra">Extra (100x100)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="width">Width *</label>
              <input 
                v-model.number="form.mapSize.width" 
                id="width" 
                type="number" 
                min="10" 
                max="100"
                required
              />
            </div>

            <div class="form-group">
              <label for="height">Height *</label>
              <input 
                v-model.number="form.mapSize.height" 
                id="height" 
                type="number" 
                min="10" 
                max="100"
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div class="form-section">
        <h2>Players</h2>
        
        <div class="player-selection">
          <div 
            v-for="player in availablePlayers" 
            :key="player.code"
            class="player-option"
            :class="{ 
              selected: isPlayerSelected(player.code), 
              disabled: !isPlayerSelected(player.code) && form.selectedPlayers.length >= 4 
            }"
            @click="togglePlayer(player)"
          >
            <img v-if="player.logo" :src="player.logo" :alt="player.name" class="player-avatar" />
            <div class="player-info">
              <strong>{{ player.name }}</strong>
              <small>{{ player.code }}</small>
            </div>
            <span class="check">{{ isPlayerSelected(player.code) ? '✓' : '' }}</span>
          </div>
        </div>
        
        <p class="hint">Selected: {{ form.selectedPlayers.length }} / 4 teams (max 4)</p>
        <p v-if="form.selectedPlayers.length >= 4" class="hint-warning">⚠️ Maximum 4 teams reached</p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="submitting || !canSubmit">
          {{ submitting ? 'Creating...' : '🚀 Create Game' }}
        </button>
        <router-link to="/games" class="btn btn-secondary">Cancel</router-link>
      </div>

      <div v-if="error" class="error-message">{{ error }}</div>
      <div v-if="success" class="success-message">{{ success }}</div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/players'
import { adminAPI } from '../api/client'

const router = useRouter()
const playerStore = usePlayerStore()

const form = ref({
  gameId: '',
  gameName: '',
  mapSize: { width: 30, height: 30 },
  selectedPlayers: [] as any[]
})

const mapConfigMode = ref<'bank' | 'custom'>('bank')
const selectedTemplate = ref('')
const selectedMapCode = ref('')
const availableMaps = ref<any[]>([])
const selectedMapData = ref<any>(null)
const submitting = ref(false)
const error = ref('')
const success = ref('')

const availablePlayers = computed(() => playerStore.players)

const canSubmit = computed(() => {
  return form.value.gameId && 
         form.value.selectedPlayers.length >= 2 &&
         form.value.selectedPlayers.length <= 4 &&
         form.value.mapSize.width >= 10 &&
         form.value.mapSize.height >= 10
})

const isPlayerSelected = (code: string) => {
  return form.value.selectedPlayers.some(p => p.code === code)
}

const togglePlayer = (player: any) => {
  const index = form.value.selectedPlayers.findIndex(p => p.code === player.code)
  if (index >= 0) {
    form.value.selectedPlayers.splice(index, 1)
  } else {
    // Only allow adding if less than 4 teams
    if (form.value.selectedPlayers.length < 4) {
      form.value.selectedPlayers.push(player)
    }
  }
}

const fetchMaps = async () => {
  try {
    const response = await adminAPI.getMaps()
    availableMaps.value = response.data
    console.log('📍 Available maps loaded:', availableMaps.value.length, availableMaps.value)
  } catch (err: any) {
    console.error('Failed to fetch maps:', err)
  }
}

const loadMapFromBank = async () => {
  if (!selectedMapCode.value) {
    selectedMapData.value = null
    return
  }

  console.log('🗺️ Loading map from bank:', selectedMapCode.value)
  error.value = ''

  try {
    const response = await adminAPI.getMapById(selectedMapCode.value)
    console.log('✅ Map loaded successfully:', response.data)
    console.log('📊 Map structure:', {
      code: response.data.code,
      width: response.data.width,
      height: response.data.height,
      hasTerrainData: !!response.data.terrain,
      hasWavesData: !!response.data.waves,
      hasTreasuresData: !!response.data.treasures,
      hasBasesData: !!response.data.bases
    })
    selectedMapData.value = response.data
    form.value.mapSize = {
      width: response.data.width,
      height: response.data.height
    }
    selectedTemplate.value = ''
  } catch (err: any) {
    error.value = 'Failed to load map from bank'
    console.error('❌ Failed to load map:', err.message)
    console.error('📋 Error response:', err.response?.data)
    console.error('📋 Error status:', err.response?.status)
    console.error('📋 Full error:', err)
  }
}

const applyTemplate = () => {
  const templates: Record<string, any> = {
    small: { width: 30, height: 30 },
    medium: { width: 40, height: 40 },
    large: { width: 50, height: 50 },
    extra: { width: 100, height: 100 }
  }
  
  if (selectedTemplate.value && templates[selectedTemplate.value]) {
    form.value.mapSize = { ...templates[selectedTemplate.value] }
  }
}

const switchMapMode = (mode: 'bank' | 'custom') => {
  mapConfigMode.value = mode
  if (mode === 'bank') {
    // When switching to bank mode, clear custom settings
    selectedTemplate.value = ''
  } else {
    // When switching to custom mode, clear bank selection
    selectedMapCode.value = ''
    selectedMapData.value = null
  }
}

const generateMap = () => {
  // If using map from bank AND we're in bank mode, use it directly
  if (mapConfigMode.value === 'bank' && selectedMapData.value) {
    console.log('🗺️ Using map from bank:', selectedMapData.value.code)
    const mapData = {
      width: selectedMapData.value.width,
      height: selectedMapData.value.height,
      terrain: selectedMapData.value.terrain || [],
      waves: selectedMapData.value.waves || [],
      treasures: selectedMapData.value.treasures || [],
      bases: selectedMapData.value.bases || [],
      owners: selectedMapData.value.owners || []
    }
    
    // Ensure we have enough bases for all players
    const numPlayers = form.value.selectedPlayers.length
    if (mapData.bases.length < numPlayers) {
      mapData.bases = generateBasesForPlayers(mapData.width, mapData.height, numPlayers)
    }
    
    return mapData
  }

  // Otherwise generate custom map
  console.log('📝 Generating custom map in', mapConfigMode.value, 'mode')
  const { width, height } = form.value.mapSize
  const numPlayers = form.value.selectedPlayers.length
  
  const centerX = width / 2
  const centerY = height / 2
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY)
  const treasureRadius = maxRadius * 0.5
  
  const treasures = Array(height).fill(0).map((_, y) => 
    Array(width).fill(0).map((_, x) => {
      const distX = x - centerX
      const distY = y - centerY
      const distance = Math.sqrt(distX * distX + distY * distY)
      
      if (distance > treasureRadius) return 0
      
      const rand = Math.random()
      if (rand < 0.03) return 100
      if (rand < 0.05) return 80
      if (rand < 0.08) return 50
      return 0
    })
  )
  
  const bases = generateBasesForPlayers(width, height, numPlayers)
  // Owners grid empty by default for custom map
  const owners = Array(height).fill(0).map(() => Array(width).fill(''))
  
  return { width, height, treasures, bases, owners }
}

const generateBasesForPlayers = (width: number, height: number, numPlayers: number) => {
  if (numPlayers === 0) {
    return [[0, 0], [width - 1, height - 1]]
  }
  
  // Generate bases distributed around the map corners and edges
  const bases: [number, number][] = []
  const padding = 2
  
  if (numPlayers === 2) {
    bases.push([padding, padding])
    bases.push([width - 1 - padding, height - 1 - padding])
  } else if (numPlayers === 3) {
    bases.push([padding, padding])
    bases.push([width - 1 - padding, padding])
    bases.push([Math.floor(width / 2), height - 1 - padding])
  } else if (numPlayers >= 4) {
    bases.push([padding, padding])
    bases.push([width - 1 - padding, padding])
    bases.push([padding, height - 1 - padding])
    bases.push([width - 1 - padding, height - 1 - padding])
    
    // If more than 4 players, add bases along edges
    for (let i = 4; i < numPlayers; i++) {
      const isTop = i % 2 === 0
      const x = padding + ((i - 4) * (width - 2 * padding)) / (numPlayers - 4)
      const y = isTop ? padding : height - 1 - padding
      bases.push([Math.floor(x), y])
    }
  }
  
  return bases.slice(0, numPlayers)
}

const handleSubmit = async () => {
  if (!canSubmit.value) return
  
  error.value = ''
  success.value = ''
  submitting.value = true
  
  try {
    const mapData = generateMap()
    
    const players = form.value.selectedPlayers.map((p, i) => ({
      playerId: p.code,
      code: p.code,
      name: p.name,
      logo: p.logo,
      teamId: `team${i + 1}`,
      position: mapData.bases[i],
      energy: 100
    }))
    
    const payload = {
      gameId: form.value.gameId,
      mapData,
      players
    }
    
    await adminAPI.initGame(payload)
    
    success.value = 'Game created successfully!'
    
    setTimeout(() => {
      router.push(`/game/${form.value.gameId}`)
    }, 1000)
    
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Failed to create game'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  playerStore.fetchPlayers()
  fetchMaps()
})
</script>

<style scoped>
.create-game {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.game-form {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.form-section {
  margin-bottom: 30px;
}

.form-section h2 {
  font-size: 18px;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 8px;
}

.map-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: #666;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
}

.tab-button:hover {
  color: #3b82f6;
  background: #f8f9fa;
}

.tab-button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  background: #f8fbff;
}

.tab-content {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.map-preview-info {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
}

.map-preview-info p {
  margin: 5px 0;
}

.divider {
  text-align: center;
  margin: 20px 0;
  color: #999;
  font-size: 14px;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 45%;
  height: 1px;
  background: #ddd;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #555;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #3b82f6;
}

.player-selection {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.player-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.player-option:hover:not(.disabled) {
  border-color: #3b82f6;
  background: #f8f9fa;
}

.player-option.selected {
  border-color: #3b82f6;
  background: #e3f2fd;
}

.player-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
}

.player-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.player-info strong {
  font-size: 14px;
}

.player-info small {
  font-size: 12px;
  color: #666;
}

.check {
  font-size: 20px;
  color: #3b82f6;
  font-weight: bold;
}

.hint {
  font-size: 13px;
  color: #666;
  margin-top: 10px;
}

.hint-warning {
  font-size: 13px;
  color: #d97706;
  margin-top: 5px;
  font-weight: 600;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  text-decoration: none;
  display: inline-block;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.error-message {
  margin-top: 15px;
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
}

.success-message {
  margin-top: 15px;
  padding: 12px;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 4px;
  color: #060;
}
</style>
