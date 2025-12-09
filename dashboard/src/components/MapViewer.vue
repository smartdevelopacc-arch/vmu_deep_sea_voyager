<template>
  <div class="map-viewer">
    <div v-if="!mapData || !mapData.width || !mapData.height" class="empty">
      No map data ({{ mapData ? 'empty object' : 'null/undefined' }})
    </div>
    
    <div v-else class="map-container">
      <div class="map-info">
        <span>{{ mapData.width }} × {{ mapData.height }}</span>
        <span>Turn: {{ currentTurn || 0 }}</span>
      </div>
      
      <div class="map-grid" :style="gridStyle">
        <div 
          v-for="(_, y) in mapData.height" 
          :key="`row-${y}`"
          class="map-row"
        >
          <div 
            v-for="(_, x) in mapData.width" 
            :key="`cell-${y}-${x}`"
            class="map-cell"
            :class="getCellClass(x, y)"
            :style="getCellStyle(x, y)"
            :title="getCellTitle(x, y)"
          >
            <!-- Hiển thị player với logo của đội -->
            <div v-if="getPlayerAtPosition(x, y)" class="player-indicator"
                 :style="getPlayerIndicatorStyle(getPlayerAtPosition(x, y)!, x, y)">
              <img 
                :src="`/dashboard/players/${getPlayerAtPosition(x, y)!.code}.png`"
                :alt="getPlayerAtPosition(x, y)!.code"
                class="player-logo"
                :title="getPlayerAtPosition(x, y)!.code"
              />
              <!-- Treasure badge nhấp nháy với giá trị nếu player đang mang treasure -->
              <span v-if="getPlayerAtPosition(x, y)!.carriedTreasure && getPlayerAtPosition(x, y)!.carriedTreasure > 0" 
                    class="treasure-badge">
                <span class="treasure-badge-icon">💎</span>
                <span class="treasure-badge-value">{{ getPlayerAtPosition(x, y)!.carriedTreasure }}</span>
              </span>
            </div>
            <!-- Hiển thị trap với màu theo player -->
            <div v-else-if="getTrapInfo(x, y)" class="trap-indicator" 
                 :style="{ borderBottomColor: getPlayerColor(getTrapInfo(x, y)!.playerId) }">
              <span class="trap-emoji">🪤</span>
              <span class="trap-danger">{{ getTrapInfo(x, y)!.danger }}</span>
            </div>
            <!-- Hiển thị treasure với value callout -->
            <div v-else-if="mapData.treasures?.[y]?.[x] > 0" class="treasure-container">
              <span class="cell-content">💎</span>
              <span class="treasure-value">{{ mapData.treasures[y][x] }}</span>
            </div>
            <img 
              v-else-if="getCellIcon(x, y)" 
              :src="getCellIcon(x, y)" 
              :alt="getCellContent(x, y)"
              class="cell-icon"
            />
            <span v-else class="cell-content">{{ getCellContent(x, y) }}</span>
          </div>
        </div>
      </div>

      <div class="map-legend">
        <div class="legend-item"><span class="icon">🏠</span> Base</div>
        <div class="legend-item"><span class="icon">⛵</span> Player</div>
        <div class="legend-item"><span class="icon">💎</span> Treasure</div>
        <div class="legend-item"><span class="icon">🪤</span> Trap</div>
        <div class="legend-item"><span class="icon">🏝️</span> Island (terrain -1)</div>
        <div class="legend-item">
          <span class="wave-sample wave-0">0</span>
          <span class="wave-sample wave-1">1</span>
          <span class="wave-sample wave-2">2</span>
          <span class="wave-sample wave-3">3</span>
          <span class="wave-sample wave-4">4</span>
          <span class="wave-sample wave-5">5</span>
          Waves
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps<{
  mapData: any
  players?: any[]
  currentTurn?: number
}>()

// Track which custom icons are available
const customIcons = ref({
  base: false,
  player: false,
  treasure: false,
  trap: false,
  island: false
})

// Player colors: Đỏ, Xanh lá, Xanh nước biển, Tím
const PLAYER_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#a855f7']

const getPlayerColor = (playerId: string) => {
  if (!playerId) return '#666'
  
  // Handle player_N format (for traps)
  const match = playerId.match(/player_(\d+)/)
  if (match && match[1]) {
    const index = parseInt(match[1])
    return PLAYER_COLORS[index % PLAYER_COLORS.length]!
  }
  
  // Handle regular playerId/code lookup
  if (!props.players) return '#666'
  const index = props.players.findIndex((p: any) => 
    (p.code === playerId) || (p.playerId === playerId)
  )
  return index >= 0 ? PLAYER_COLORS[index % PLAYER_COLORS.length]! : '#666'
}

/**
 * Get player indicator style - show base color as border if player is at base
 */
const getPlayerIndicatorStyle = (player: any, x: number, y: number) => {
  const playerColor = getPlayerColor(player.playerId || player.code)
  const style: any = {
    backgroundColor: playerColor
  }
  
  // If player is at base, add thick border with base color tint
  if (props.mapData?.bases && props.players) {
    const baseIndex = props.mapData.bases.findIndex((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    
    if (baseIndex >= 0 && baseIndex < props.players.length) {
      // Player is at their base - add thick border
      const r = parseInt(playerColor.slice(1, 3), 16)
      const g = parseInt(playerColor.slice(3, 5), 16)
      const b = parseInt(playerColor.slice(5, 7), 16)
      style.border = `3px solid rgba(${r}, ${g}, ${b}, 0.8)`
      style.boxShadow = `inset 0 0 8px rgba(${r}, ${g}, ${b}, 0.6)`
    }
  }
  
  return style
}

const getPlayerAtPosition = (x: number, y: number): any | null => {
  if (!props.players) return null
  const player = props.players.find((p: any) => {
    const px = p.position?.x ?? (Array.isArray(p.position) ? p.position[0] : null)
    const py = p.position?.y ?? (Array.isArray(p.position) ? p.position[1] : null)
    return px === x && py === y
  })
  return player || null
}

const getTrapInfo = (x: number, y: number): { playerId: string; danger: number } | null => {
  if (!props.mapData?.traps) return null
  
  const trapsArray = Array.isArray(props.mapData.traps) 
    ? props.mapData.traps 
    : Object.values(props.mapData.traps)
  
  const trap = trapsArray.find((t: any) => {
    if (!t) return false
    const tx = t.position?.x ?? (Array.isArray(t.position) ? t.position[0] : (Array.isArray(t) ? t[0] : null))
    const ty = t.position?.y ?? (Array.isArray(t.position) ? t.position[1] : (Array.isArray(t) ? t[1] : null))
    return tx === x && ty === y
  })
  
  if (trap) {
    return {
      playerId: trap.playerId || trap[3] || '',
      danger: trap.danger || trap[2] || 0
    }
  }
  return null
}

// Check if custom icon files exist
onMounted(() => {
  const iconTypes = ['base', 'player', 'treasure', 'trap', 'island']
  iconTypes.forEach(type => {
    const img = new Image()
    img.onload = () => {
      customIcons.value[type as keyof typeof customIcons.value] = true
    }
    img.onerror = () => {
      customIcons.value[type as keyof typeof customIcons.value] = false
    }
    img.src = `/dashboard/icons/${type}.png`
  })
  
  // Debug: log traps data
  if (props.mapData?.traps) {
    const trapsArray = Array.isArray(props.mapData.traps) 
      ? props.mapData.traps 
      : Object.values(props.mapData.traps)
    console.log('🪤 MapViewer traps:', trapsArray.length, trapsArray)
  } else {
    console.log('🪤 MapViewer: No traps in mapData')
  }
})

// Watch for trap changes
watch(() => props.mapData?.traps, (newTraps) => {
  if (newTraps) {
    const trapsArray = Array.isArray(newTraps) ? newTraps : Object.values(newTraps)
    console.log('🪤 Traps updated:', trapsArray.length, trapsArray)
  }
}, { deep: true })

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.mapData?.width || 10}, 1fr)`,
  gridTemplateRows: `repeat(${props.mapData?.height || 10}, 1fr)`
}))

const getCellClass = (x: number, y: number) => {
  const classes = []
  
  // Check island (terrain -1)
  const terrain = props.mapData?.terrain || props.mapData?.obstacles
  if (terrain?.[y]?.[x] === -1) {
    classes.push('island')
  }
  
  return classes.join(' ')
}

const getCellStyle = (x: number, y: number) => {
  // Check if this is a base position
  if (props.mapData?.bases && props.players) {
    const baseIndex = props.mapData.bases.findIndex((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    
    if (baseIndex >= 0 && baseIndex < props.players.length) {
      // Map base index to player (player i has base i)
      const playerColor = getPlayerColor(props.players[baseIndex].playerId || props.players[baseIndex].code)
      // Convert hex to rgba with 0.5 opacity for better visibility
      const r = parseInt(playerColor.slice(1, 3), 16)
      const g = parseInt(playerColor.slice(3, 5), 16)
      const b = parseInt(playerColor.slice(5, 7), 16)
      return {
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.5)`
      }
    }
  }
  
  // Wave energy - màu xanh với độ đậm nhất (0-5)
  const wave = props.mapData?.waves?.[y]?.[x] ?? 0
  const opacity = 0.02 + (wave / 5) * 0.93 // 0→0.02, 5→0.95 (much darker/more saturated)
  
  return {
    backgroundColor: `rgba(59, 130, 246, ${opacity})` // Blue with varying opacity
  }
}

const getCellContent = (x: number, y: number) => {
  // Prioritize player over base so player isn't hidden at base
  if (props.players) {
    const player = props.players.find((p: any) => {
      const px = p.position?.x ?? (Array.isArray(p.position) ? p.position[0] : null)
      const py = p.position?.y ?? (Array.isArray(p.position) ? p.position[1] : null)
      return px === x && py === y
    })
    if (player) return '👤'
  }

  // Base (only if no player occupying)
  if (props.mapData?.bases) {
    const isBase = props.mapData.bases.some((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    if (isBase) return '🏠'
  }
  
  // Check traps
  if (props.mapData?.traps) {
    // Traps có thể là Map hoặc Array
    const trapsArray = Array.isArray(props.mapData.traps) 
      ? props.mapData.traps 
      : Object.values(props.mapData.traps)
    
    const trap = trapsArray.find((t: any) => {
      if (!t) return false
      const tx = t.position?.x ?? (Array.isArray(t.position) ? t.position[0] : (Array.isArray(t) ? t[0] : null))
      const ty = t.position?.y ?? (Array.isArray(t.position) ? t.position[1] : (Array.isArray(t) ? t[1] : null))
      return tx === x && ty === y
    })
    if (trap) return '🪤'
  }
  
  // Check treasure
  const treasure = props.mapData?.treasures?.[y]?.[x]
  if (treasure && treasure > 0) return '💎'
  
  // Check island (terrain -1)
  const terrain = props.mapData?.terrain || props.mapData?.obstacles
  if (terrain?.[y]?.[x] === -1) return '🏝️'
  
  return ''
}

const getCellIcon = (x: number, y: number): string | undefined => {
  // Player first
  if (props.players) {
    const player = props.players.find((p: any) => {
      const px = p.position?.x ?? (Array.isArray(p.position) ? p.position[0] : null)
      const py = p.position?.y ?? (Array.isArray(p.position) ? p.position[1] : null)
      return px === x && py === y
    })
    if (player && customIcons.value.player) return '/dashboard/icons/player.png'
  }

  // Base (only if no player icon already chosen)
  if (props.mapData?.bases) {
    const isBase = props.mapData.bases.some((b: any) => {
      const bx = Array.isArray(b) ? b[0] : b.x
      const by = Array.isArray(b) ? b[1] : b.y
      return bx === x && by === y
    })
    if (isBase && customIcons.value.base) return '/dashboard/icons/base.png'
  }
  
  // Check traps
  if (props.mapData?.traps) {
    const trapsArray = Array.isArray(props.mapData.traps) 
      ? props.mapData.traps 
      : Object.values(props.mapData.traps)
    
    const trap = trapsArray.find((t: any) => {
      if (!t) return false
      const tx = t.position?.x ?? (Array.isArray(t.position) ? t.position[0] : (Array.isArray(t) ? t[0] : null))
      const ty = t.position?.y ?? (Array.isArray(t.position) ? t.position[1] : (Array.isArray(t) ? t[1] : null))
      return tx === x && ty === y
    })
    if (trap && customIcons.value.trap) return '/dashboard/icons/trap.png'
  }
  
  // Check treasure
  const treasure = props.mapData?.treasures?.[y]?.[x]
  if (treasure && treasure > 0 && customIcons.value.treasure) return '/dashboard/icons/treasure.png'
  
  // Check island (terrain -1)
  const terrain = props.mapData?.terrain || props.mapData?.obstacles
  if (terrain?.[y]?.[x] === -1 && customIcons.value.island) return '/dashboard/icons/island.png'
  
  return undefined
}

const getCellTitle = (x: number, y: number) => {
  const parts = [`(${x}, ${y})`]
  
  const wave = props.mapData?.waves?.[y]?.[x]
  if (wave) parts.push(`Wave: ${wave}`)
  
  const treasure = props.mapData?.treasures?.[y]?.[x]
  if (treasure) parts.push(`Treasure: ${treasure}`)
  
  if (props.players) {
    const player = props.players.find((p: any) => 
      p.position?.x === x && p.position?.y === y
    )
    if (player) parts.push(`Player: ${player.code || 'Unknown'}`)
  }
  
  return parts.join(' | ')
}
</script>

<style scoped>
.map-viewer {
  width: 100%;
  height: 100%;
  align-self: flex-start;
  position: relative;
  z-index: 1;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.map-container {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-height: 100%;
  display: flex;
  flex-direction: column;
}

.map-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #666;
  font-weight: 600;
  flex-shrink: 0;
}

.map-grid {
  display: grid;
  gap: 1px;
  background: #ddd;
  border: 2px solid #999;
  aspect-ratio: 1 / 1;
  width: 100%;
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  margin: 0 auto;
  overflow: hidden;
  box-sizing: border-box;
  flex: 1;
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
  font-size: clamp(8px, 0.8vw, 16px);
  overflow: hidden;
}

.map-cell:hover {
  transform: scale(1.05);
  z-index: 10;
  box-shadow: 0 0 8px rgba(0,0,0,0.3);
}

.cell-content {
  font-size: 1.2em;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-icon {
  max-width: 80%;
  max-height: 80%;
  object-fit: contain;
  pointer-events: none;
}

.player-indicator {
  width: 80%;
  height: 80%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  border: 2px solid rgba(255,255,255,0.5);
  position: relative;
  overflow: hidden;
  background: white;
}

.player-logo {
  width: 85%;
  height: 85%;
  object-fit: contain;
  border-radius: 50%;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.player-icon {
  font-size: 1.1em;
  line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.treasure-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  animation: treasure-blink 1s ease-in-out infinite;
  filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.8));
  z-index: 1;
}

.treasure-badge-icon {
  font-size: 0.9em;
  line-height: 1;
}

.treasure-badge-value {
  font-size: 0.6em;
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 4px;
  padding: 1px 4px;
  min-width: 18px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.3);
  line-height: 1.2;
}

@keyframes treasure-blink {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(1.2);
  }
}

.trap-indicator {
  width: 0;
  height: 0;
  border-left: 1.5em solid transparent;
  border-right: 1.5em solid transparent;
  border-bottom: 2.5em solid;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 5% auto 0;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
}

.trap-emoji {
  position: absolute;
  top: 1em;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1em;
  line-height: 1;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.trap-danger {
  position: absolute;
  top: 2.7em;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7em;
  background: rgba(0,0,0,0.9);
  color: white;
  border-radius: 6px;
  padding: 2px 5px;
  font-weight: bold;
  white-space: nowrap;
  border: 1px solid rgba(255,255,255,0.3);
}

.treasure-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.treasure-container .cell-content {
  font-size: 2.2em;
}

.treasure-value {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: max(0.6rem, 8%);
  font-weight: bold;
  color: white;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 6px;
  padding: 1px 1px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.3);
  min-width: 15px;
  text-align: center;
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 20px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 13px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-item .icon {
  font-size: 16px;
}

.wave-sample {
  display: inline-block;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  color: white;
  margin-right: 2px;
}

.wave-0 {
  background: rgba(59, 130, 246, 0.02);
  color: #333;
}

.wave-1 {
  background: rgba(59, 130, 246, 0.21);
  color: #333;
}

.wave-2 {
  background: rgba(59, 130, 246, 0.40);
}

.wave-3 {
  background: rgba(59, 130, 246, 0.59);
}

.wave-4 {
  background: rgba(59, 130, 246, 0.78);
}

.wave-5 {
  background: rgba(59, 130, 246, 0.95);
}
</style>
