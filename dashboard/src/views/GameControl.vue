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
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in finishedLeaderboard" :key="row.playerId">
              <td>{{ idx + 1 }}</td>
              <td>
                <span class="player-badge" :style="{ backgroundColor: getPlayerColor(idx) }">
                  {{ row.name || row.code || row.playerId }}
                </span>
              </td>
              <td class="score-cell">{{ row.score }}</td>
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

          <div class="players-section" v-if="currentGame.players">
            <h2>Leaderboard</h2>
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Position</th>
                  <th>Energy</th>
                  <th>Score</th>
                  <th>Traps</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(player, index) in sortedPlayers" :key="player.code">
                  <td>
                    <span class="player-badge" :style="{ backgroundColor: getPlayerColor(index) }">
                      {{ player.teamName || player.name || player.code }}
                    </span>
                  </td>
                  <td>({{ player.position?.x }}, {{ player.position?.y }})</td>
                  <td>{{ player.energy }}</td>
                  <td class="score-cell">{{ player.score || 0 }}</td>
                  <td>{{ player.trapCount || 0 }}</td>
                </tr>
              </tbody>
            </table>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

const getPlayerColor = (index: number): string => {
  return PLAYER_COLORS[index % PLAYER_COLORS.length]!
}

const sortedPlayers = computed(() => {
  if (!currentGame.value?.players) return []
  return [...currentGame.value.players].sort((a, b) => (b.score || 0) - (a.score || 0))
})

// Leaderboard data when game finished: prefer finalScores from server
const finishedLeaderboard = computed(() => {
  const finalScores: Array<{ playerId: string; score: number }> = (currentGame.value as any)?.finalScores || []
  if (finalScores.length) {
    // Enrich with player code if available
    const playersById: Record<string, any> = {}
    for (const p of currentGame.value?.players || []) {
      playersById[p.playerId] = p
    }
    // Also enrich from global players store (may have names/teamName)
    const globalByCode: Record<string, any> = {}
    for (const gp of playerStore.players || []) {
      globalByCode[gp.code] = gp
    }
    return [...finalScores]
      .sort((a, b) => b.score - a.score)
      .map(s => ({
        playerId: s.playerId,
        score: s.score,
        code: playersById[s.playerId]?.code || s.playerId,
        name:
          playersById[s.playerId]?.teamName ||
          playersById[s.playerId]?.name ||
          globalByCode[playersById[s.playerId]?.code || s.playerId]?.teamName ||
          globalByCode[playersById[s.playerId]?.code || s.playerId]?.name ||
          undefined
      }))
  }
  // Fallback to current players' scores if finalScores not provided
  // Use global players store to fill names if missing
  const globalByCode: Record<string, any> = {}
  for (const gp of playerStore.players || []) {
    globalByCode[gp.code] = gp
  }
  return (currentGame.value?.players || [])
    .map(p => ({
      playerId: p.playerId,
      score: p.score || 0,
      code: p.code,
      name: p.teamName || p.name || globalByCode[p.code]?.teamName || globalByCode[p.code]?.name
    }))
    .sort((a, b) => b.score - a.score)
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
    alert('Game started!')
  } catch (err) {
    alert('Failed to start game')
  }
}

const handleStop = async () => {
  try {
    await gameStore.stopGame(gameId)
    isActive.value = false
    stopCountdown()
    alert('Game stopped!')
  } catch (err) {
    alert('Failed to stop game')
  }
}

const handleReset = async () => {
  if (!confirm('Are you sure you want to reset the game to initial state? This will clear all progress.')) {
    return
  }
  try {
    await gameStore.resetGame(gameId)
    await fetchState() // Refresh state after reset
    alert('Game reset to initial state!')
  } catch (err: any) {
    alert('Failed to reset game: ' + (err.response?.data?.error || err.message))
  }
}

onMounted(() => {
  fetchState()
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
})

onUnmounted(() => {
  if (tickListener) {
    socket.value?.off('game:tick:complete', tickListener)
  }
  stopCountdown()
})
</script>

<style scoped>
.game-control {
  padding: 20px;
}

.actions {
  margin: 20px 0;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
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

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

.info-card {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.info-card h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.info-card p {
  font-size: 24px;
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
}

.map-section {
  flex: 0 0 auto;
  max-width: calc(100vh - 250px);
  width: 100%;
}

.info-sidebar {
  flex: 1;
  min-width: 300px;
  max-width: 400px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.players-section {
  margin-top: 20px;
}

.players-section h2 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 18px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 14px;
}

th, td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

.player-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
  font-weight: bold;
  font-size: 13px;
}

.score-cell {
  font-weight: bold;
  font-size: 16px;
}

.socket-status {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.socket-status h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
}

.connected {
  color: #22c55e;
  font-weight: 600;
}

.disconnected {
  color: #ef4444;
  font-weight: 600;
}

.last-update {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
}
</style>
