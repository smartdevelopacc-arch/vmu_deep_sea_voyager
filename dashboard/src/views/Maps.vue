<template>
  <div class="maps-page">
    <div class="page-header">
      <h1>🗺️ Map Management</h1>
      <div class="header-buttons">
        <button @click="showCreateModal = true" class="btn btn-primary">➕ Create Map</button>
        <button @click="refreshMaps" class="btn btn-secondary">🔄 Refresh</button>
      </div>
    </div>

    <!-- Create Map Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="modal-content">
        <h2>Create New Map</h2>
        
        <div class="form-section">
          <label>Map Code: <span class="required">*</span></label>
          <input v-model="newMapForm.code" type="text" class="input-field" placeholder="e.g., map_custom_1" />
          <small>Unique identifier for the map</small>
        </div>

        <div class="form-section">
          <label>Map Name: <span class="required">*</span></label>
          <input v-model="newMapForm.name" type="text" class="input-field" placeholder="e.g., Custom Arena" />
        </div>

        <div class="form-section">
          <label>Description:</label>
          <textarea v-model="newMapForm.description" class="textarea-field" rows="3" placeholder="Optional description"></textarea>
        </div>

        <div class="form-row">
          <div class="form-section">
            <label>Width: <span class="required">*</span></label>
            <input v-model.number="newMapForm.width" type="number" min="10" max="100" class="input-field" />
          </div>
          
          <div class="form-section">
            <label>Height: <span class="required">*</span></label>
            <input v-model.number="newMapForm.height" type="number" min="10" max="100" class="input-field" />
          </div>
        </div>

        <div class="form-section">
          <label>
            <input v-model="newMapForm.disable" type="checkbox" />
            Start as disabled
          </label>
        </div>

        <div class="modal-actions">
          <button @click="submitCreateMap" class="btn btn-success" :disabled="!isCreateFormValid">
            ✅ Create Map
          </button>
          <button @click="cancelCreate" class="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading maps...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="maps-container">
      <!-- Maps Grid -->
      <div class="maps-grid">
        <div v-for="map in maps" :key="map._id" class="map-card" :class="{ active: selectedMap?._id === map._id }" @click="selectMap(map)">
          <div class="map-header">
            <h3>{{ map.name || map.code }}</h3>
            <span class="map-code">{{ map.code }}</span>
          </div>
          <div class="map-info">
            <div><strong>Size:</strong> {{ map.width }} × {{ map.height }}</div>
            <div><strong>Bases:</strong> {{ map.bases?.length || 0 }}</div>
            <div><strong>Treasures:</strong> {{ countTreasures(map) }}</div>
            <div><strong>Status:</strong> <span :class="map.disable ? 'badge-disabled' : 'badge-active'">{{ map.disable ? 'Disabled' : 'Active' }}</span></div>
          </div>
        </div>
      </div>

      <!-- Map Editor Panel -->
      <div v-if="selectedMap" class="editor-panel">
        <div class="editor-header">
          <h2>{{ selectedMap.name || selectedMap.code }}</h2>
          <div class="header-actions">
            <div class="editor-tabs">
              <button 
                @click="editorMode = 'metadata'" 
                :class="['tab-btn', { active: editorMode === 'metadata' }]"
              >
                📝 Metadata
              </button>
              <button 
                @click="editorMode = 'content'" 
                :class="['tab-btn', { active: editorMode === 'content' }]"
              >
                🗺️ Map Content
              </button>
            </div>
            <button @click="deleteMap" class="btn btn-danger btn-sm">🗑️ Delete</button>
          </div>
        </div>

        <!-- Metadata Editor -->
        <div v-if="editorMode === 'metadata'" class="metadata-editor">
          <div class="editor-section">
            <label>Name:</label>
            <input v-model="editingMap.name" type="text" class="input-field" />
          </div>

          <div class="editor-section">
            <label>Description:</label>
            <textarea v-model="editingMap.description" class="textarea-field" rows="3"></textarea>
          </div>

          <div class="editor-section">
            <label>
              <input v-model="editingMap.disable" type="checkbox" />
              Disable Map
            </label>
          </div>

          <!-- ✅ NEW: Map Settings Section -->
          <div class="editor-section settings-section">
            <h3>⚙️ Game Settings</h3>
            
            <div class="setting-group">
              <label>
                <input type="checkbox" v-model="mapSettingsEnableTraps">
                Enable Traps
              </label>
            </div>

            <div class="setting-group">
              <label>Max Energy:</label>
              <input 
                type="number" 
                v-model.number="mapSettingsMaxEnergy" 
                min="10"
                max="500"
                class="input-field"
              >
            </div>

            <div class="setting-group">
              <label>Energy Restore per Turn:</label>
              <input 
                type="number" 
                v-model.number="mapSettingsEnergyRestore" 
                min="0"
                max="50"
                class="input-field"
              >
            </div>

            <div class="setting-group">
              <label>Max Turns:</label>
              <input 
                type="number" 
                v-model.number="mapSettingsMaxTurns" 
                min="100"
                max="10000"
                step="100"
                class="input-field"
              >
            </div>

            <div class="setting-group">
              <label>Time Limit (minutes):</label>
              <input 
                type="number" 
                v-model.number="mapSettingsTimeLimitMinutes" 
                min="1"
                max="60"
                step="1"
                class="input-field"
              >
            </div>

            <div class="setting-group">
              <label>Tick Interval (ms):</label>
              <input 
                type="number" 
                v-model.number="mapSettingsTickIntervalMs" 
                min="250"
                max="5000"
                step="50"
                class="input-field"
              >
            </div>
          </div>

          <div class="editor-actions">
            <button @click="saveMapMetadata" class="btn btn-success">💾 Save Metadata</button>
            <button @click="cancelEdit" class="btn btn-secondary">Cancel</button>
          </div>

          <div class="map-preview">
            <h3>Preview</h3>
            <MapViewer :mapData="selectedMap" :players="[]" />
          </div>
        </div>

        <!-- Content Editor -->
        <div v-if="editorMode === 'content'" class="content-editor">
          <MapContentEditor 
            v-if="selectedMap" 
            :mapData="selectedMap" 
            @save="saveMapContent"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import apiClient from '../api/client'
import MapViewer from '../components/MapViewer.vue'
import MapContentEditor from '../components/MapContentEditor.vue'

interface MapData {
  _id: string
  code: string
  name: string
  description?: string
  width: number
  height: number
  disable: boolean
  terrain: number[][]
  treasures: number[][]
  bases: number[][]
  waves?: number[][]
  owners?: (string | number)[][]
  settings?: {
    enableTraps?: boolean
    maxEnergy?: number
    energyRestore?: number
    maxTurns?: number
    timeLimitMs?: number
    tickIntervalMs?: number
  }
}

type NormalizedMap = MapData & {
  terrain: number[][]
  treasures: number[][]
  waves: number[][]
  bases: number[][]
}

const makeGrid = (grid: number[][] | undefined, width: number, height: number, fill: number) => {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => grid?.[y]?.[x] ?? fill)
  )
}

const normalizeMap = (map: MapData): NormalizedMap => ({
  ...map,
  terrain: makeGrid(map.terrain, map.width, map.height, 0),
  treasures: makeGrid(map.treasures, map.width, map.height, 0),
  waves: makeGrid(map.waves, map.width, map.height, 2),
  bases: map.bases || []
})

const client = apiClient
const maps = ref<NormalizedMap[]>([])
const selectedMap = ref<NormalizedMap | null>(null)
const editingMap = ref<Partial<NormalizedMap>>({})
const editorMode = ref<'metadata' | 'content'>('metadata')
const loading = ref(false)
const error = ref('')
const showCreateModal = ref(false)
const newMapForm = ref({
  code: '',
  name: '',
  description: '',
  width: 30,
  height: 30,
  disable: false
})

onMounted(() => {
  refreshMaps()
})

const refreshMaps = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await client.get('/maps')
    maps.value = (response.data || []).map((m: MapData) => normalizeMap(m))
  } catch (err: any) {
    error.value = err.message || 'Failed to load maps'
  } finally {
    loading.value = false
  }
}

const isCreateFormValid = computed(() => {
  return newMapForm.value.code && 
         newMapForm.value.name && 
         newMapForm.value.width >= 10 && 
         newMapForm.value.width <= 100 &&
         newMapForm.value.height >= 10 && 
         newMapForm.value.height <= 100
})

const mapSettingsTimeLimitMinutes = computed({
  get: () => {
    const ms = editingMap.value.settings?.timeLimitMs || 300000
    return Math.round((ms / 60000) * 10) / 10 // Round to 1 decimal place
  },
  set: (minutes: number) => {
    if (editingMap.value.settings) {
      editingMap.value.settings.timeLimitMs = Math.round(minutes * 60000)
    }
  }
})

const mapSettingsTickIntervalMs = computed({
  get: () => {
    return editingMap.value.settings?.tickIntervalMs || 500
  },
  set: (ms: number) => {
    if (editingMap.value.settings) {
      editingMap.value.settings.tickIntervalMs = ms
    }
  }
})

const mapSettingsEnableTraps = computed({
  get: () => {
    return editingMap.value.settings?.enableTraps ?? true
  },
  set: (value: boolean) => {
    if (editingMap.value.settings) {
      editingMap.value.settings.enableTraps = value
    }
  }
})

const mapSettingsMaxEnergy = computed({
  get: () => {
    return editingMap.value.settings?.maxEnergy || 100
  },
  set: (value: number) => {
    console.log('🔧 Setting maxEnergy to:', value)
    if (editingMap.value.settings) {
      editingMap.value.settings.maxEnergy = value
      console.log('✅ maxEnergy set, current settings:', editingMap.value.settings)
    } else {
      console.error('❌ editingMap.value.settings is undefined!')
    }
  }
})

const mapSettingsEnergyRestore = computed({
  get: () => {
    return editingMap.value.settings?.energyRestore || 10
  },
  set: (value: number) => {
    if (editingMap.value.settings) {
      editingMap.value.settings.energyRestore = value
    }
  }
})

const mapSettingsMaxTurns = computed({
  get: () => {
    return editingMap.value.settings?.maxTurns || 1200
  },
  set: (value: number) => {
    if (editingMap.value.settings) {
      editingMap.value.settings.maxTurns = value
    }
  }
})

const cancelCreate = () => {
  showCreateModal.value = false
  newMapForm.value = {
    code: '',
    name: '',
    description: '',
    width: 30,
    height: 30,
    disable: false
  }
}

const submitCreateMap = async () => {
  if (!isCreateFormValid.value) return
  
  try {
    // Create empty map
    const newMap = {
      code: newMapForm.value.code,
      name: newMapForm.value.name,
      description: newMapForm.value.description,
      width: newMapForm.value.width,
      height: newMapForm.value.height,
      disable: newMapForm.value.disable,
      terrain: Array(newMapForm.value.height).fill(0).map(() => Array(newMapForm.value.width).fill(0)),
      treasures: Array(newMapForm.value.height).fill(0).map(() => Array(newMapForm.value.width).fill(0)),
      waves: Array(newMapForm.value.height).fill(0).map(() => Array(newMapForm.value.width).fill(2)),
      bases: []
    }
    
    const response = await client.post('/maps', newMap)
    console.log('✅ Map created:', response.data)
    
    if (!response.data._id) {
      console.error('⚠️ Created map missing _id:', response.data)
    }
    
    maps.value.push(normalizeMap(response.data))
    maps.value.sort((a, b) => a.code.localeCompare(b.code))
    
    alert(`✅ Map "${newMapForm.value.code}" created successfully`)
    
    // Reset form and close modal
    cancelCreate()
    
    // Auto-select the new map
    selectMap(response.data)
    editorMode.value = 'content'
  } catch (err: any) {
    console.error('❌ Failed to create map:', err)
    error.value = err.message || 'Failed to create map'
    alert(`❌ Error: ${err.response?.data?.error || err.message || 'Failed to create map'}`)
  }
}

const selectMap = (map: MapData) => {
  console.log('🔍 selectMap called with:', map.code, 'settings:', map.settings)
  
  const normalized = normalizeMap(map)
  selectedMap.value = normalized
  
  // Create a clean editing copy with all settings fields
  editingMap.value = {
    _id: normalized._id,
    code: normalized.code,
    name: normalized.name,
    description: normalized.description,
    width: normalized.width,
    height: normalized.height,
    disable: normalized.disable,
    terrain: normalized.terrain,
    treasures: normalized.treasures,
    bases: normalized.bases,
    waves: normalized.waves,
    owners: normalized.owners,
    settings: {
      enableTraps: normalized.settings?.enableTraps ?? true,
      maxEnergy: normalized.settings?.maxEnergy ?? 100,
      energyRestore: normalized.settings?.energyRestore ?? 10,
      maxTurns: normalized.settings?.maxTurns ?? 1200,
      timeLimitMs: normalized.settings?.timeLimitMs ?? 300000,
      tickIntervalMs: normalized.settings?.tickIntervalMs ?? 500
    }
  }
  
  console.log('✅ editingMap initialized with settings:', editingMap.value.settings)
  editorMode.value = 'metadata'
}

const cancelEdit = () => {
  selectedMap.value = null
  editingMap.value = {}
  editorMode.value = 'metadata'
}

const saveMapMetadata = async () => {
  if (!selectedMap.value) return
  
  console.log('💾 Saving map metadata:', {
    name: editingMap.value.name,
    settings: editingMap.value.settings
  })
  
  try {
    const response = await client.put(`/maps/${selectedMap.value._id}`, {
      name: editingMap.value.name,
      description: editingMap.value.description,
      disable: editingMap.value.disable,
      settings: editingMap.value.settings
    })
    
    console.log('✅ Server response:', response.data)
    
    alert('✅ Map metadata saved successfully')
    
    // Clear editing state completely - like closing and reopening the page
    selectedMap.value = null
    editingMap.value = {}
    editorMode.value = 'metadata'
    
    // Refresh the entire map list from server
    await refreshMaps()
    
  } catch (err: any) {
    console.error('❌ Save error:', err)
    error.value = err.message || 'Failed to save map'
    alert(`❌ Error: ${err.message || 'Failed to save map'}`)
  }
}

const saveMapContent = async (mapContent: any) => {
  if (!selectedMap.value) {
    alert('❌ No map selected')
    return
  }
  
  const mapId = selectedMap.value._id
  if (!mapId) {
    alert('❌ Map ID is missing')
    console.error('Selected map:', selectedMap.value)
    return
  }
  
  console.log('📤 Sending map content update for ID:', mapId)
  console.log('Map content:', mapContent)
  
  try {
    const response = await client.put(`/maps/${mapId}`, {
      terrain: mapContent.terrain,
      treasures: mapContent.treasures,
      waves: mapContent.waves,
      bases: mapContent.bases
    })
    
    console.log('✅ Map content saved:', response.data)
    
    // Update local map and preserve selectedMap
    const updatedMap = normalizeMap(response.data)
    const index = maps.value.findIndex(m => m._id === mapId)
    if (index >= 0) {
      maps.value[index] = updatedMap
    }
    
    // Update selectedMap to maintain _id
    selectedMap.value = {
      ...updatedMap,
      _id: mapId // Ensure _id is preserved
    }
    
    alert('✅ Map content saved successfully')
  } catch (err: any) {
    console.error('❌ Failed to save map content:', err)
    error.value = err.message || 'Failed to save map content'
    alert(`❌ Error: ${err.response?.data?.error || err.message || 'Failed to save map content'}`)
  }
}

const deleteMap = async () => {
  if (!selectedMap.value) return
  
  const mapName = selectedMap.value.name || selectedMap.value.code
  const confirmMessage = `⚠️ WARNING: Delete map "${mapName}"?\n\nThis will permanently delete:\n- Map: ${mapName}\n- Size: ${selectedMap.value.width}x${selectedMap.value.height}\n- ${countTreasures(selectedMap.value)} treasure cells\n- ${selectedMap.value.bases?.length || 0} bases\n\nThis action CANNOT be undone!\n\nType the map code "${selectedMap.value.code}" to confirm:`
  
  const userInput = prompt(confirmMessage)
  
  if (userInput !== selectedMap.value.code) {
    if (userInput !== null) {
      alert('❌ Deletion cancelled - code did not match')
    }
    return
  }
  
  try {
    await client.delete(`/maps/${selectedMap.value._id}`)
    
    // Remove from list
    maps.value = maps.value.filter(m => m._id !== selectedMap.value?._id)
    const deletedCode = selectedMap.value.code
    selectedMap.value = null
    editingMap.value = {}
    
    alert(`✅ Map "${deletedCode}" deleted successfully`)
  } catch (err: any) {
    error.value = err.message || 'Failed to delete map'
    alert(`❌ Error: ${err.message || 'Failed to delete map'}`)
  }
}

const countTreasures = (map: MapData) => {
  if (!map.treasures) return 0
  let count = 0
  for (const row of map.treasures) {
    for (const cell of row) {
      if (cell > 0) count++
    }
  }
  return count
}
</script>

<style scoped>
.maps-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e5e7eb;
}

.page-header h1 {
  font-size: 28px;
  color: #1f2937;
  margin: 0;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.maps-container {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 20px;
}

.maps-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  max-height: 80vh;
  overflow-y: auto;
  padding-right: 10px;
}

.map-card {
  padding: 15px;
  border: 2px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.map-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
  transform: translateX(4px);
}

.map-card.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 10px;
}

.map-header h3 {
  font-size: 16px;
  color: #1f2937;
  margin: 0;
  flex: 1;
}

.map-code {
  font-size: 12px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
}

.map-info {
  font-size: 13px;
  color: #6b7280;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.map-info div {
  display: flex;
  justify-content: space-between;
}

.badge-active {
  background: #dcfce7;
  color: #166534;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.badge-disabled {
  background: #fee2e2;
  color: #991b1b;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 11px;
}

.editor-panel {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: white;
  height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e5e7eb;
}

.editor-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 20px;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.editor-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 8px 16px;
  border: 2px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.tab-btn.active {
  border-color: #3b82f6;
  background: #3b82f6;
  color: white;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.modal-content h2 {
  margin: 0 0 25px 0;
  color: #1f2937;
  font-size: 24px;
}

.form-section {
  margin-bottom: 20px;
}

.form-section label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
  font-size: 14px;
}

.form-section small {
  display: block;
  color: #6b7280;
  font-size: 12px;
  margin-top: 4px;
}

.required {
  color: #ef4444;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.modal-actions .btn {
  flex: 1;
}

.metadata-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.content-editor {
  flex: 1;
  min-height: 700px;
  display: flex;
  flex-direction: column;
}

.editor-panel h2 {
  margin: 0 0 20px 0;
  color: #1f2937;
  font-size: 20px;
}

.editor-section {
  margin-bottom: 15px;
}

.editor-section label {
  display: block;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.input-field,
.textarea-field {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.input-field:focus,
.textarea-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.textarea-field {
  resize: vertical;
  min-height: 80px;
}

.editor-section input[type="checkbox"] {
  margin-right: 8px;
  cursor: pointer;
}

.map-preview {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.map-preview h3 {
  margin: 0 0 15px 0;
  color: #374151;
  font-size: 14px;
}

.editor-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-success:hover {
  background: #16a34a;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.loading,
.error {
  text-align: center;
  padding: 40px;
  font-size: 16px;
}

.error {
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}

@media (max-width: 1024px) {
  .maps-container {
    grid-template-columns: 1fr;
  }

  .maps-grid {
    max-height: 40vh;
  }

  .editor-panel {
    max-height: 50vh;
  }
}

@media (max-width: 768px) {
  .maps-page {
    padding: 10px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .editor-actions {
    grid-template-columns: 1fr;
  }
}
</style>
