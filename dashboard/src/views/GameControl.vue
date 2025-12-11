<template>
  <div class="game-control">
    <h1>🎮 Game Control: {{ gameId }}</h1>

    <div class="actions">
      <button @click="fetchState" class="btn btn-primary">🔄 Refresh State</button>
      <button @click="handleStart" class="btn btn-success" :disabled="isActive">▶️ Start Game</button>
      <button @click="handleStop" class="btn btn-danger" :disabled="!isActive">⏹️ Stop Game</button>
      <button @click="handleReset" class="btn btn-warning" :disabled="isActive">🔄 Reset Game</button>
      <router-link :to="`/game/${gameId}/settings`" class="btn btn-secondary">⚙️ Settings</router-link>
      <router-link to="/games" class="btn btn-secondary">← Back to Games</router-link>
    </div>

    <div v-if="loading" class="loading">Loading game state...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <!-- Game Finished Banner with Leaderboard -->
    <div v-else-if="currentGame && currentGame.status === 'finished'" class="game-finished-banner">
      <h2>🏁 Game Finished!</h2>
      <p>The game has ended. Leaderboard is shown below.</p>
      <div class="finished-leaderboard" v-if="finishedLeaderboard.length">
        <h3>🏆 Leaderboard</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>Final Score</th>
              <th>Fastest Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in finishedLeaderboard" :key="row.playerId">
              <td>{{ idx + 1 }}</td>
              <td>
                <div class="team-display">
                  <img 
                    v-if="row.teamLogo" 
                    :src="row.teamLogo" 
                    :alt="row.teamName"
                    class="team-logo"
                  />
                  <span class="player-badge" :style="{ backgroundColor: getPlayerColor(row) }">
                    {{ row.displayName || row.teamName || row.name || row.code || row.playerId }}
                  </span>
                  <div v-if="row.slogan" class="team-slogan">“{{ row.slogan }}”</div>
                </div>
              </td>
              <td class="score-cell">{{ row.score }}</td>
              <td class="time-cell">{{ formatLastScoreTime(row.lastScoreTime, currentGame.startedAt || currentGame.startTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button @click="handleReset" class="btn btn-warning">🔄 Reset Game</button>
    </div>

    <div v-else-if="currentGame" class="game-state">
      <div class="game-layout">
        <!-- Map Viewer - Left side -->
        <div class="map-section">
          <MapViewer 
            :mapData="currentGame.map" 
            :players="currentGame.players"
            :currentTurn="currentGame.currentTurn"
          />
        </div>

        <!-- Info - Right side -->
        <div class="info-sidebar">
          <!-- Sponsors Section -->
          <div class="sponsors-section">
            <h3>Sponsors</h3>
            <div class="sponsors-grid">
              <div class="ad-slot">
                <img src="/dashboard/sponsors/vmu.png" alt="Advertisement" />
              </div>
              <div class="ad-slot">
                <img src="/dashboard/sponsors/lg.png" alt="Advertisement" />
              </div>
              <div class="ad-slot">
                <img src="/dashboard/sponsors/fit.png" alt="Advertisement" />
              </div>
            </div>
          </div>


          <div class="players-section" v-if="currentGame.players">
            <h2>Leaderboard</h2>
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Energy</th>
                  <th>Score</th>
                  <th>Traps</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="player in sortedPlayers" 
                    :key="player.code"
                    :class="{ 'score-updated': recentScoreUpdates.includes(player.code) }"
                    class="player-row">
                  <td>
                    <div class="team-display">
                      <img 
                        v-if="player.teamLogo" 
                        :src="player.teamLogo" 
                        :alt="player.code"
                        class="team-logo-small"
                      />
                      <span class="player-badge" :style="{ backgroundColor: getPlayerColor(player) }">
                        {{ player.name || player.teamName || player.code }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div class="energy-bar-container">
                      <div class="energy-bar" :style="getEnergyBarStyle(player.energy)">
                        <span class="energy-text">{{ player.energy }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="score-cell">{{ player.score || 0 }}</td>
                  <td>{{ player.trapCount || 0 }}/{{ MAX_TRAPS }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="info-grid">
        <div class="info-card">
          <h3>Status</h3>
          <p :class="'status-' + currentGame.status">{{ currentGame.status }}</p>
        </div>
        <div class="info-card">
          <h3>Current Turn</h3>
          <p>{{ currentGame.currentTurn || 0 }}</p>
        </div>
        <div class="info-card">
          <h3>Players</h3>
          <p>{{ currentGame.players?.length || 0 }}</p>
        </div>
        <div class="info-card">
          <h3>Active Loop</h3>
          <p>{{ isActive ? '✅ Running' : '❌ Stopped' }}</p>
        </div>
        <div class="info-card" v-if="isActive">
          <h3>Time Remaining</h3>
          <p :class="{ 'time-warning': timeRemaining < 60000 }">{{ formatTimeRemaining }}</p>
        </div>
          </div>

          <div class="socket-status">
            <h3>Real-time Updates</h3>
            <p :class="{ 'connected': socketConnected, 'disconnected': !socketConnected }">
              {{ socketConnected ? '🟢 Connected' : '🔴 Disconnected' }}
            </p>
            <p v-if="lastUpdate" class="last-update">Last update: {{ lastUpdate }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { usePlayerStore } from '../stores/players'
import { useGameSocket } from '../composables/useSocket'
import MapViewer from '../components/MapViewer.vue'

const route = useRoute()
const gameId = route.params.id as string
const gameStore = useGameStore()
const playerStore = usePlayerStore()

const lastUpdate = ref<string | null>(null)
const isActive = ref(false)
const timeRemaining = ref<number>(0)
const countdownInterval = ref<number | null>(null)
const countdownStartTime = ref<number>(0) // Track khi bắt đầu countdown
const recentScoreUpdates = ref<string[]>([])

const currentGame = computed(() => gameStore.currentGame)
const loading = computed(() => gameStore.loading)
const error = computed(() => gameStore.error)

const formatTimeRemaining = computed(() => {
  if (!timeRemaining.value || timeRemaining.value <= 0) return '0:00'
  const totalSeconds = Math.floor(timeRemaining.value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const updateTimeRemaining = () => {
  if (!isActive.value) {
    timeRemaining.value = 0
    return
  }
  
  // Dùng countdownStartTime đã được set khi startCountdown
  const timeLimit = currentGame.value?.settings?.timeLimitMs || 300000 // 5 minutes default
  const elapsed = Date.now() - countdownStartTime.value
  timeRemaining.value = Math.max(0, timeLimit - elapsed)
  
  console.log(`[Countdown] Elapsed: ${elapsed}ms, Remaining: ${timeRemaining.value}ms`)
  
  // Auto stop if time is up
  if (timeRemaining.value <= 0 && isActive.value) {
    console.log('⏰ Time limit reached, stopping game...')
    handleStop()
  }
}

const startCountdown = () => {
  stopCountdown()
  
  // Lưu startTime: ưu tiên từ DB, nếu không có thì dùng hiện tại
  countdownStartTime.value = currentGame.value?.startTime || Date.now()
  console.log(`[Countdown] Starting with startTime: ${new Date(countdownStartTime.value).toISOString()}`)
  
  updateTimeRemaining()
  countdownInterval.value = window.setInterval(updateTimeRemaining, 1000)
}

const stopCountdown = () => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
    countdownInterval.value = null
  }
}

const { socket, connected: socketConnected } = useGameSocket(gameId, gameStore, () => {
  lastUpdate.value = new Date().toLocaleTimeString()
})

// Player colors: Đỏ, Xanh lá, Xanh nước biển, Tím
const PLAYER_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#a855f7']

const getPlayerColor = (player: any): string => {
  // Use originalIndex to maintain consistent colors even when sorted
  const index = player.originalIndex ?? 0
  return PLAYER_COLORS[index % PLAYER_COLORS.length]!
}

// ✅ ENHANCED: Get energy bar color gradient (red -> yellow -> green)
const getEnergyColor = (energy: number, maxEnergy: number = 100): string => {
  const percentage = Math.min(100, Math.max(0, (energy / maxEnergy) * 100))
  
  if (percentage < 33) {
    // Đỏ (0-33%)
    return '#ef4444'
  } else if (percentage < 66) {
    // Vàng (33-66%)
    return '#eab308'
  } else {
    // Xanh lá (66-100%)
    return '#22c55e'
  }
}

const getEnergyBarStyle = (energy: number, maxEnergy: number = 100): any => {
  const percentage = Math.min(100, Math.max(0, (energy / maxEnergy) * 100))
  const color = getEnergyColor(energy, maxEnergy)
  
  return {
    width: `${percentage}%`,
    backgroundColor: color,
    transition: 'all 0.3s ease'
  }
}

const MAX_TRAPS = 5 // Matching backend MAX_TRAPS_PER_PLAYER

const sortedPlayers = computed(() => {
  if (!currentGame.value?.players) return []
  
  // Build player map from global players store by playerId and code
  const playersById: Record<string, any> = {}
  const playersByCode: Record<string, any> = {}
  for (const gp of playerStore.players || []) {
    if (gp._id) playersById[gp._id] = gp
    if (gp.code) playersByCode[gp.code] = gp
  }
  
  const result = [...currentGame.value.players]
    .map((p: any, originalIndex: number) => {
      // Try to find global player info by playerId or code
      const globalPlayer = playersById[p.playerId] || playersByCode[p.code]
      
      // ✅ ENHANCED: Prefer code as display name for leaderboard
      const displayName = p.code || p.teamName || globalPlayer?.teamName || globalPlayer?.name || p.name || p.playerId
      
      // Get team logo from player code (e.g., "team_13" -> "/public/players/team_13.png")
      const teamLogo = p.code ? `/dashboard/players/${p.code}.png` : null
      
      const enriched = {
        ...p,
        // ✅ ENHANCED: Preserve original index for consistent color assignment
        originalIndex,
        // Use code as primary display (team identifier)
        teamName: p.code,
        // Keep original name for detail
        name: p.name || globalPlayer?.name || displayName,
        // Ensure code is always present
        code: p.code || p.playerId,
        // ✅ NEW: Add team logo URL
        teamLogo
      }
      
      return enriched
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
  
  return result
})

// Leaderboard data when game finished: prefer finalScores from server
const finishedLeaderboard = computed(() => {
  console.log('🏆 finishedLeaderboard computed - currentGame:', currentGame.value)
  console.log('🏆 startTime:', currentGame.value?.startTime)
  console.log('🏆 startedAt:', currentGame.value?.startedAt)
  
  const finalScores: Array<{ playerId: string; score: number; lastScoreTime?: Date | string }> = (currentGame.value as any)?.finalScores || []
  if (finalScores.length) {
    // Enrich with player code if available
    const playersById: Record<string, any> = {}
    const playerOriginalIndex: Record<string, number> = {}
    for (const [idx, p] of (currentGame.value?.players || []).entries()) {
      playersById[p.playerId] = p
      playerOriginalIndex[p.playerId] = idx
    }
    
    // Debug: Check what's in playersById
    console.log('🏆 finishedLeaderboard - playersById:', playersById);
    
    // Also enrich from global players store (may have names/teamName)
    const globalByCode: Record<string, any> = {}
    for (const gp of playerStore.players || []) {
      globalByCode[gp.code] = gp
    }
    return [...finalScores]
      .sort((a, b) => {
        // Sort by score descending first
        if (b.score !== a.score) return b.score - a.score
        
        // If scores are equal, sort by lastScoreTime ascending (earlier time wins)
        if (a.lastScoreTime && b.lastScoreTime) {
          return new Date(a.lastScoreTime).getTime() - new Date(b.lastScoreTime).getTime()
        }
        // Players without lastScoreTime go last
        if (a.lastScoreTime && !b.lastScoreTime) return -1
        if (!a.lastScoreTime && b.lastScoreTime) return 1
        return 0
      })
      .map(s => {
        const playerCode = playersById[s.playerId]?.code || s.playerId
        const displayName =
          playersById[s.playerId]?.teamName ||
          playersById[s.playerId]?.name ||
          globalByCode[playerCode]?.teamName ||
          globalByCode[playerCode]?.name ||
          playerCode ||
          s.playerId
        const slogan =
          playersById[s.playerId]?.slogan ||
          globalByCode[playerCode]?.slogan ||
          ''
        console.log(`🏆 Player ${s.playerId} slogan: "${slogan}" (from playersById: "${playersById[s.playerId]?.slogan}" or globalByCode: "${globalByCode[playerCode]?.slogan}")`);
        console.log(`🏆 Player ${s.playerId} lastScoreTime from finalScores:`, s.lastScoreTime, 'from playersById:', playersById[s.playerId]?.lastScoreTime);
        return {
          playerId: s.playerId,
          score: s.score,
          code: playerCode,
          teamName: displayName,
          teamLogo: playerCode ? `/dashboard/players/${playerCode}.png` : null,
          originalIndex: playerOriginalIndex[s.playerId] ?? 0,
          name: displayName,
          displayName,
          slogan,
          lastScoreTime: s.lastScoreTime || playersById[s.playerId]?.lastScoreTime // ✅ FIXED: Prefer lastScoreTime from finalScores
        }
      })
  }
  // Fallback to current players' scores if finalScores not provided
  // Use global players store to fill names if missing
  const globalByCode: Record<string, any> = {}
  for (const gp of playerStore.players || []) {
    globalByCode[gp.code] = gp
  }
  return (currentGame.value?.players || [])
    .map((p: any, originalIndex: number) => ({
      playerId: p.playerId,
      score: p.score || 0,
      code: p.code,
      teamName: p.teamName || p.name || globalByCode[p.code]?.teamName || globalByCode[p.code]?.name || p.code,
      teamLogo: p.code ? `/dashboard/players/${p.code}.png` : null,
      originalIndex,
      name: p.teamName || p.name || globalByCode[p.code]?.teamName || globalByCode[p.code]?.name,
      displayName: p.teamName || p.name || globalByCode[p.code]?.teamName || globalByCode[p.code]?.name || p.code || p.playerId,
      slogan: p.slogan || globalByCode[p.code]?.slogan || '',
      lastScoreTime: p.lastScoreTime
    }))
    .sort((a: any, b: any) => {
      // Sort by score descending first
      if (b.score !== a.score) return b.score - a.score
      
      // If scores are equal, sort by lastScoreTime ascending (earlier time wins)
      if (a.lastScoreTime && b.lastScoreTime) {
        return new Date(a.lastScoreTime).getTime() - new Date(b.lastScoreTime).getTime()
      }
      // Players without lastScoreTime go last
      if (a.lastScoreTime && !b.lastScoreTime) return -1
      if (!a.lastScoreTime && b.lastScoreTime) return 1
      return 0
    })
})

let tickListener: ((data: any) => void) | null = null

const fetchState = async () => {
  // Full sync of this game
  await gameStore.fetchGameState(gameId)
  // Lightweight loop status instead of full games list
  try {
    const res = await (await import('../api/client')).adminAPI.getLoopStatus(gameId)
    isActive.value = !!res.data.loopActive
  } catch (e) {
    // Fallback: derive from status
    isActive.value = currentGame.value?.status === 'playing'
  }
  
  // Start countdown if game is active
  if (isActive.value) {
    startCountdown()
  } else {
    stopCountdown()
  }
}

const handleStart = async () => {
  try {
    await gameStore.startGame(gameId)
    isActive.value = true
    await fetchState() // Refresh to get startTime
    startCountdown()
    console.log('Game started!')
  } catch (err) {
    console.error('Failed to start game', err)
  }
}

const handleStop = async () => {
  try {
    await gameStore.stopGame(gameId)
    isActive.value = false
    stopCountdown()
    console.log('Game stopped!')
  } catch (err) {
    console.error('Failed to stop game', err)
  }
}

const handleReset = async () => {
  if (!confirm('Are you sure you want to reset the game to initial state? This will clear all progress.')) {
    return
  }
  try {
    await gameStore.resetGame(gameId)
    await fetchState() // Refresh state after reset
    console.log('Game reset to initial state!')
  } catch (err: any) {
    console.error('Failed to reset game: ' + (err.response?.data?.error || err.message))
  }
}

onMounted(() => {
  fetchState()
  
  // Sync isActive with game status when it changes to finished
  watch(() => currentGame.value?.status, (newStatus) => {
    if (newStatus === 'finished') {
      isActive.value = false
      stopCountdown()
      console.log('🏁 Game status changed to finished, stopping countdown and disabling active state')
      // ✅ FETCH PLAYERS TO GET SLOGAN DATA from Player collection for leaderboard display
      console.log('🏁 Fetching players data for leaderboard display...')
      playerStore.fetchPlayers()
    }
  })
  
  // Attach tick complete listener to refresh full state
  tickListener = (data: any) => {
    if (!data || data.gameId !== gameId) return
    // Just update turn (already handled by useGameSocket turn:new) fallback
    if (typeof data.turn === 'number') {
      gameStore.updateTurn(data.turn)
      lastUpdate.value = new Date().toLocaleTimeString()
    }
    // Optionally could trigger periodic full sync every N ticks
  }
  socket.value?.on('game:tick:complete', tickListener)
  
  // ✅ ENHANCED: Watch for score changes to trigger animation (uses correct event name)
  socket.value?.on('player:score:changed', (data: any) => {
    if (data?.playerId) {
      // Find player code from playerId
      const player = currentGame.value?.players?.find((p: any) => 
        p.playerId === data.playerId || p.code === data.playerId
      )
      const playerCode = player?.code || data.playerId
      
      recentScoreUpdates.value.push(playerCode)
      lastUpdate.value = new Date().toLocaleTimeString()
      
      // Remove after animation
      setTimeout(() => {
        const idx = recentScoreUpdates.value.indexOf(playerCode)
        if (idx > -1) {
          recentScoreUpdates.value.splice(idx, 1)
        }
      }, 1500)
    }
  })
})

// Format last score time relative to game start time (MM:SS format)
const formatLastScoreTime = (lastScoreTime: string | Date | undefined, gameStartTime: Date | number | undefined): string => {
  console.log('🕐 formatLastScoreTime called:', { lastScoreTime, gameStartTime, gameStartTimeType: typeof gameStartTime })
  
  if (!lastScoreTime) {
    console.log('🕐 No lastScoreTime, returning -')
    return '-'
  }
  if (!gameStartTime) {
    console.log('🕐 No gameStartTime, returning -')
    return '-'
  }
  
  try {
    const scoreDate = new Date(lastScoreTime)
    if (isNaN(scoreDate.getTime())) {
      console.log('🕐 Invalid scoreDate:', lastScoreTime)
      return '-'
    }
    
    // Parse start time - handle both Date object and timestamp number
    let startDate: Date
    if (typeof gameStartTime === 'number') {
      startDate = new Date(gameStartTime)
    } else {
      startDate = new Date(gameStartTime)
    }
    
    if (isNaN(startDate.getTime())) {
      console.warn('🕐 Invalid game start time:', gameStartTime)
      return '-'
    }
    
    console.log('🕐 Calculating duration:', { scoreDate: scoreDate.toISOString(), startDate: startDate.toISOString() })
    
    // Calculate difference in milliseconds from game start to last score
    const diffMs = scoreDate.getTime() - startDate.getTime()
    
    if (diffMs < 0) {
      console.warn('🕐 Score time is before start time', { scoreDate, startDate })
      return '-'
    }
    
    const totalSeconds = Math.floor(diffMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const milliseconds = Math.floor((diffMs % 1000) / 10) // Get centiseconds (2 digits)
    
    const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
    console.log('🕐 Formatted time:', formatted)
    
    // Format as MM:SS.ms
    return formatted
  } catch (error) {
    console.error('🕐 Error formatting last score time:', error)
    return '-'
  }
}


onUnmounted(() => {
  if (tickListener) {
    socket.value?.off('game:tick:complete', tickListener)
  }
  stopCountdown()
})
</script>

<style scoped>
.game-control {
  padding: 15px;
  max-width: 100%;
  margin: 0 auto;
}

.game-state {
  height: 95vh;
  display: flex;
  flex-direction: column;
}

.actions {
  margin: 20px 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  position: relative;
  z-index: 101;
  pointer-events: auto;
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

.btn-success {
  background: #22c55e;
  color: white;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.loading, .error {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #ef4444;
}

.game-finished-banner {
  text-align: center;
  padding: 60px 40px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border-radius: 12px;
  margin: 40px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.game-finished-banner h2 {
  font-size: 2.5em;
  margin: 0 0 20px 0;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.game-finished-banner p {
  font-size: 1.2em;
  margin: 0 0 30px 0;
  color: white;
}

.game-finished-banner .btn {
  font-size: 1.2em;
  padding: 15px 30px;
}

.finished-leaderboard {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 20px;
  margin: 20px auto;
  max-width: 720px;
}

.finished-leaderboard h3 {
  margin: 0 0 10px 0;
}

.finished-leaderboard table {
  width: 100%;
  border-collapse: collapse;
}

.finished-leaderboard th, .finished-leaderboard td {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}

.finished-leaderboard .score-cell {
  font-weight: 600;
}

.finished-leaderboard .time-cell {
  font-weight: 700;
  color: #059669;
  font-size: 1.1em;
}

.finished-leaderboard .team-slogan {
  font-size: 12px;
  color: #4b5563;
  margin-top: 4px;
  font-style: italic;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin: 15px 0;
}

.info-card {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}

.info-card h3 {
  margin: 0 0 3px 0;
  font-size: 10px;
  color: #666;
}

.info-card p {
  font-size: 14px;
  font-weight: bold;
  margin: 0;
}

.time-warning {
  color: #ef4444 !important;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-playing {
  color: #22c55e;
}

.status-waiting {
  color: #f59e0b;
}

.status-finished {
  color: #6b7280;
}

.game-layout {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  flex: 1;
  min-height: 0;
}

.map-section {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 95vh;
  position: relative;
  z-index: 1;
}

/* Keep map area square by constraining to the smaller of available width/height */
.map-section::before {
  content: '';
  display: block;
  padding-top: 100%;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  pointer-events: none;
}

.map-section > * {
  position: absolute;
  inset: 0;
  margin: auto;
  width: min(100%, 100vh);
  height: min(100%, 100vh);
}

.info-sidebar {
  flex: 0 0 auto;
  min-width: 350px;
  max-width: 450px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sponsors-section {
  margin-bottom: 12px;
  background: #f9fafb;
  padding: 10px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sponsors-section h3 {
  margin: 0 0 6px 0;
  font-size: 12px;
  color: #374151;
  text-align: center;
}

.ad-slot {
  position: relative;
  background: white;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  width: 100%;
  padding-top: 100%; /* square ratio */
}

.ad-slot img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  padding: 10px
}

.sponsors-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(90px, 1fr));
  gap: 8px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.players-section {
  margin-top: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}

.players-section h2 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 12px;
  background: white;
  border-radius: 6px;
  overflow: hidden;
}

th, td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: middle;
}

th {
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
  font-weight: 700;
  color: white;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

tr:hover {
  background: #f0f9ff;
}

tr:last-child td {
  border-bottom: none;
}

/* ✅ ENHANCED: Energy bar styling */
.energy-bar-container {
  width: 100%;
  height: 24px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
}

.energy-bar {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  min-width: 24px;
}

.energy-text {
  color: white;
  font-weight: bold;
  font-size: 11px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  user-select: none;
}tr {
  margin: 0;
  padding: 0;
}

tbody tr {
  border-spacing: 0;
}

.player-badge {
  display: inline-block;
  width: 100px;
  min-height: 28px;
  padding: 6px 10px;
  border-radius: 12px;
  color: white;
  font-weight: bold;
  font-size: 11px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: normal;
  word-wrap: break-word;
  line-height: 1.3;
  text-align: center;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.team-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.team-logo {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  object-fit: contain;
  background: white;
  border: 1px solid #e5e7eb;
}

.team-logo-small {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  object-fit: contain;
  background: white;
  border: 1px solid #e5e7eb;
}

.team-name {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
}

.score-cell {
  font-weight: bold;
  font-size: 14px;
  color: #1e40af;
  text-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.socket-status {
  margin-top: 12px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 6px;
}

.socket-status h3 {
  margin-top: 0;
  margin-bottom: 6px;
  font-size: 13px;
}

.connected {
  color: #22c55e;
  font-weight: 600;
  font-size: 11px;
}

.disconnected {
  color: #ef4444;
  font-weight: 600;
  font-size: 11px;
}

.last-update {
  font-size: 10px;
  color: #666;
  margin-top: 4px;
}

@keyframes scoreHighlight {
  0% {
    background: #fbbf24;
    transform: translateY(-2px);
  }
  50% {
    background: #fcd34d;
    transform: translateY(0);
  }
  100% {
    background: transparent;
    transform: translateY(0);
  }
}

@keyframes scoreMove {
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

.player-row {
  transition: all 0.3s ease;
}

.player-row.score-updated {
  animation: scoreMove 0.6s ease-out, scoreHighlight 0.8s ease-out;
}

.player-row.score-updated .score-cell {
  animation: scoreHighlight 0.8s ease-out;
  font-size: 16px !important;
}
</style>
