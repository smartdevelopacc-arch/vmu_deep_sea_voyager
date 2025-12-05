<template>
  <div class="game-settings">
    <div class="header">
      <h1>⚙️ Game Settings: {{ gameId }}</h1>
      <router-link :to="`/game/${gameId}`" class="btn btn-secondary">
        ← Back to Game
      </router-link>
    </div>

    <div v-if="loading" class="loading">Loading settings...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="settings-container">
      <!-- Game Settings Section -->
      <div class="section">
        <h2>🎮 Game Settings</h2>
        <div class="form-group">
          <label>
            <input type="checkbox" v-model="settings.enableTraps" :disabled="!canEdit">
            Enable Traps
          </label>
          <small>Allow players to place traps on the map</small>
        </div>

        <div class="form-group">
          <label>Max Energy</label>
          <input 
            type="number" 
            v-model.number="settings.maxEnergy" 
            :disabled="!canEdit"
            min="10"
            max="500"
          >
          <small>Maximum energy a player can have (10-500)</small>
        </div>

        <div class="form-group">
          <label>Energy Restore per Turn</label>
          <input 
            type="number" 
            v-model.number="settings.energyRestore" 
            :disabled="!canEdit"
            min="0"
            max="50"
          >
          <small>Energy recovered when idle (0-50)</small>
        </div>

        <div class="form-group">
          <label>Max Turns</label>
          <input 
            type="number" 
            v-model.number="settings.maxTurns" 
            :disabled="!canEdit"
            min="100"
            max="10000"
          >
          <small>Maximum number of game turns (100-10000)</small>
        </div>

        <div class="form-group">
          <label>Time Limit (minutes)</label>
          <input 
            type="number" 
            v-model.number="timeLimitMinutes" 
            :disabled="!canEdit"
            min="1"
            max="60"
            step="0.5"
          >
          <small>Game duration in minutes (1-60)</small>
        </div>

        <div class="form-group">
          <label>Tick Interval (ms)</label>
          <input 
            type="number" 
            v-model.number="settings.tickIntervalMs" 
            :disabled="!canEdit"
            min="500"
            max="5000"
            step="100"
          >
          <small>Time between game ticks in milliseconds (500-5000ms)</small>
        </div>

        <div class="actions">
          <button 
            @click="saveSettings" 
            class="btn btn-primary"
            :disabled="!canEdit || saving"
          >
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
          <button 
            @click="resetSettings" 
            class="btn btn-secondary"
            :disabled="!canEdit"
          >
            Reset to Default
          </button>
        </div>

        <div v-if="!canEdit" class="warning">
          ⚠️ Settings can only be modified when game status is "waiting"
        </div>
      </div>

      <!-- Map Editor Section -->
      <div class="section">
        <h2>🗺️ Map Configuration</h2>
        
        <div class="map-info">
          <div class="info-item">
            <strong>Size:</strong> {{ mapData.width }} × {{ mapData.height }}
          </div>
          <div class="info-item">
            <strong>Bases:</strong> {{ mapData.bases?.length || 0 }}
          </div>
          <div class="info-item">
            <strong>Total Treasures:</strong> {{ totalTreasures }}
          </div>
        </div>

        <div class="map-preview">
          <MapViewer 
            :mapData="mapData" 
            :players="[]"
            :currentTurn="0"
          />
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" v-model="showMapEditor" :disabled="!canEdit">
            Enable Map Editor
          </label>
          <small>Advanced: Modify terrain, waves, and treasures</small>
        </div>

        <div v-if="showMapEditor && canEdit" class="map-editor">
          <div class="editor-tools">
            <select v-model="editMode">
              <option value="terrain">Terrain (Islands)</option>
              <option value="waves">Waves (0-5)</option>
              <option value="treasures">Treasures</option>
              <option value="bases">Bases</option>
            </select>
            
            <input 
              v-if="editMode !== 'bases'"
              type="number" 
              v-model.number="brushValue" 
              :min="editMode === 'terrain' ? -1 : 0"
              :max="editMode === 'waves' ? 5 : 100"
              placeholder="Value"
            >
            
            <button @click="clearLayer" class="btn btn-danger">
              Clear {{ editMode }}
            </button>
          </div>

          <div class="grid-editor" :style="gridStyle">
            <div 
              v-for="y in mapData.height" 
              :key="`row-${y-1}`"
              class="grid-row"
            >
              <div 
                v-for="x in mapData.width" 
                :key="`cell-${y-1}-${x-1}`"
                class="grid-cell"
                :class="getCellClass(x-1, y-1)"
                @click="editCell(x-1, y-1)"
                :title="getCellValue(x-1, y-1)"
              >
                <span class="cell-value">{{ getCellDisplay(x-1, y-1) }}</span>
              </div>
            </div>
          </div>

          <div class="actions">
            <button 
              @click="saveMap" 
              class="btn btn-primary"
              :disabled="saving"
            >
              {{ saving ? 'Saving...' : 'Save Map' }}
            </button>
            <button 
              @click="loadOriginalMap" 
              class="btn btn-secondary"
            >
              Reload Original
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="successMessage" class="success-toast">
      ✓ {{ successMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import MapViewer from '../components/MapViewer.vue';

const route = useRoute();
const gameId = route.params.id as string;

const loading = ref(true);
const error = ref('');
const saving = ref(false);
const successMessage = ref('');
const canEdit = ref(false);
const showMapEditor = ref(false);

// Settings data
const settings = ref({
  enableTraps: true,
  maxEnergy: 100,
  energyRestore: 10,
  maxTurns: 1200,
  timeLimitMs: 300000,
  tickIntervalMs: 500
});

const timeLimitMinutes = computed({
  get: () => settings.value.timeLimitMs / 60000,
  set: (minutes: number) => {
    settings.value.timeLimitMs = minutes * 60000;
  }
});

// Map data
const mapData = ref({
  width: 10,
  height: 10,
  terrain: [] as number[][],
  waves: [] as number[][],
  treasures: [] as number[][],
  bases: [] as any[]
});

const originalMapData = ref<any>(null);

// Map editor state
const editMode = ref<'terrain' | 'waves' | 'treasures' | 'bases'>('terrain');
const brushValue = ref(0);

const totalTreasures = computed(() => {
  return mapData.value.treasures.reduce((sum, row) => 
    sum + row.reduce((rowSum, val) => rowSum + val, 0), 0
  );
});

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${mapData.value.width}, 30px)`,
  gridTemplateRows: `repeat(${mapData.value.height}, 30px)`
}));

onMounted(async () => {
  await loadData();
});

const loadData = async () => {
  try {
    loading.value = true;
    error.value = '';

    // Load settings
    const settingsRes = await axios.get(`/api/game/${gameId}/settings`);
    settings.value = settingsRes.data.settings;

    // Load game status
    const statusRes = await axios.get(`/api/game/${gameId}/status`);
    canEdit.value = statusRes.data.status === 'waiting';

    // Load map
    const mapRes = await axios.get(`/api/game/${gameId}/map`);
    mapData.value = {
      width: mapRes.data.terrain[0]?.length || 10,
      height: mapRes.data.terrain?.length || 10,
      terrain: JSON.parse(JSON.stringify(mapRes.data.terrain)),
      waves: JSON.parse(JSON.stringify(mapRes.data.waves)),
      treasures: JSON.parse(JSON.stringify(mapRes.data.treasures)),
      bases: mapRes.data.bases || []
    };
    
    originalMapData.value = JSON.parse(JSON.stringify(mapData.value));
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  try {
    saving.value = true;
    await axios.put(`/api/admin/game/${gameId}/settings`, settings.value);
    
    successMessage.value = 'Settings saved successfully!';
    setTimeout(() => successMessage.value = '', 3000);
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    saving.value = false;
  }
};

const resetSettings = () => {
  settings.value = {
    enableTraps: true,
    maxEnergy: 100,
    energyRestore: 10,
    maxTurns: 1200,
    timeLimitMs: 300000,
    tickIntervalMs: 500
  };
};

const saveMap = async () => {
  try {
    saving.value = true;
    await axios.put(`/api/game/${gameId}/map`, {
      terrain: mapData.value.terrain,
      waves: mapData.value.waves,
      treasures: mapData.value.treasures,
      bases: mapData.value.bases
    });
    
    successMessage.value = 'Map saved successfully!';
    setTimeout(() => successMessage.value = '', 3000);
    originalMapData.value = JSON.parse(JSON.stringify(mapData.value));
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message;
  } finally {
    saving.value = false;
  }
};

const loadOriginalMap = () => {
  if (originalMapData.value) {
    mapData.value = JSON.parse(JSON.stringify(originalMapData.value));
  }
};

const editCell = (x: number, y: number) => {
  if (!canEdit.value || !showMapEditor.value) return;

  switch (editMode.value) {
    case 'terrain':
      if (mapData.value.terrain[y]) {
        mapData.value.terrain[y][x] = brushValue.value;
      }
      break;
    case 'waves':
      if (mapData.value.waves[y]) {
        mapData.value.waves[y][x] = brushValue.value;
      }
      break;
    case 'treasures':
      if (mapData.value.treasures[y]) {
        mapData.value.treasures[y][x] = brushValue.value;
      }
      break;
    case 'bases':
      // Toggle base
      const baseIndex = mapData.value.bases.findIndex((b: any) => {
        const bx = Array.isArray(b) ? b[0] : b.x;
        const by = Array.isArray(b) ? b[1] : b.y;
        return bx === x && by === y;
      });
      if (baseIndex >= 0) {
        mapData.value.bases.splice(baseIndex, 1);
      } else {
        mapData.value.bases.push({ x, y });
      }
      break;
  }
};

const getCellValue = (x: number, y: number): string => {
  const values = [];
  if (mapData.value.terrain[y]?.[x] === -1) values.push('Island');
  values.push(`Wave: ${mapData.value.waves[y]?.[x] || 0}`);
  if (mapData.value.treasures[y]?.[x]) values.push(`Treasure: ${mapData.value.treasures[y][x]}`);
  
  const baseIndex = mapData.value.bases.findIndex((b: any) => {
    const bx = Array.isArray(b) ? b[0] : b.x;
    const by = Array.isArray(b) ? b[1] : b.y;
    return bx === x && by === y;
  });
  if (baseIndex >= 0) values.push(`Base ${baseIndex + 1}`);
  
  return values.join(', ');
};

const getCellDisplay = (x: number, y: number): string => {
  // Check base first
  const baseIndex = mapData.value.bases.findIndex((b: any) => {
    const bx = Array.isArray(b) ? b[0] : b.x;
    const by = Array.isArray(b) ? b[1] : b.y;
    return bx === x && by === y;
  });
  if (baseIndex >= 0) return '🏠';
  
  // Then treasure
  const treasure = mapData.value.treasures[y]?.[x];
  if (treasure && treasure > 0) return '💎';
  
  // Then island
  if (mapData.value.terrain[y]?.[x] === -1) return '🏝️';
  
  // Finally wave
  const wave = mapData.value.waves[y]?.[x] || 0;
  return wave.toString();
};

const getCellClass = (x: number, y: number): string => {
  const classes = [];
  
  if (mapData.value.terrain[y]?.[x] === -1) classes.push('island');
  
  const wave = mapData.value.waves[y]?.[x] || 0;
  classes.push(`wave-${wave}`);
  
  if (mapData.value.treasures[y]?.[x]) classes.push('has-treasure');
  
  const hasBase = mapData.value.bases.some((b: any) => {
    const bx = Array.isArray(b) ? b[0] : b.x;
    const by = Array.isArray(b) ? b[1] : b.y;
    return bx === x && by === y;
  });
  if (hasBase) classes.push('has-base');
  
  return classes.join(' ');
};

const clearLayer = () => {
  if (!confirm(`Clear all ${editMode.value}?`)) return;
  
  switch (editMode.value) {
    case 'terrain':
      mapData.value.terrain = Array(mapData.value.height).fill(0)
        .map(() => Array(mapData.value.width).fill(0));
      break;
    case 'waves':
      mapData.value.waves = Array(mapData.value.height).fill(0)
        .map(() => Array(mapData.value.width).fill(1));
      break;
    case 'treasures':
      mapData.value.treasures = Array(mapData.value.height).fill(0)
        .map(() => Array(mapData.value.width).fill(0));
      break;
    case 'bases':
      mapData.value.bases = [];
      break;
  }
};
</script>

<style scoped>
.game-settings {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
}

.settings-container {
  display: grid;
  gap: 30px;
}

.section {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.section h2 {
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 20px;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
}

.form-group input[type="number"],
.form-group input[type="text"] {
  width: 100%;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group input[type="checkbox"] {
  margin-right: 8px;
}

.form-group small {
  display: block;
  margin-top: 5px;
  color: #666;
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #22c55e;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #16a34a;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #4b5563;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.warning {
  margin-top: 15px;
  padding: 12px;
  background: #fef3c7;
  border-left: 4px solid #f59e0b;
  border-radius: 4px;
  color: #92400e;
}

.map-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.info-item {
  padding: 10px;
  background: #f9fafb;
  border-radius: 4px;
}

.map-preview {
  margin: 20px 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.map-editor {
  margin-top: 20px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.editor-tools {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.editor-tools select,
.editor-tools input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.grid-editor {
  display: grid;
  gap: 2px;
  margin: 20px 0;
  padding: 10px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: auto;
  max-width: 100%;
}

.grid-row {
  display: contents;
}

.grid-cell {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  cursor: pointer;
  font-size: 11px;
  transition: transform 0.1s;
}

.grid-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 0 5px rgba(0,0,0,0.3);
}

.grid-cell.island {
  background: #d1d5db;
}

.grid-cell.has-treasure {
  background: #fef3c7;
}

.grid-cell.has-base {
  background: #dbeafe;
  font-weight: bold;
}

.grid-cell.wave-0 { background-color: rgba(59, 130, 246, 0.1); }
.grid-cell.wave-1 { background-color: rgba(59, 130, 246, 0.2); }
.grid-cell.wave-2 { background-color: rgba(59, 130, 246, 0.3); }
.grid-cell.wave-3 { background-color: rgba(59, 130, 246, 0.4); }
.grid-cell.wave-4 { background-color: rgba(59, 130, 246, 0.5); }
.grid-cell.wave-5 { background-color: rgba(59, 130, 246, 0.6); }

.cell-value {
  user-select: none;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  font-size: 18px;
}

.error {
  color: #ef4444;
}

.success-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  background: #22c55e;
  color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: slideIn 0.3s ease;
  z-index: 1000;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
