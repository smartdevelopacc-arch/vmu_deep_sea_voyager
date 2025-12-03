<template>
  <div class="games-page">
    <h1>🎮 Games</h1>
    <GameList 
      :games="games" 
      :loading="loading" 
      :error="error"
      @start="startGame"
      @stop="stopGame"
    >
      <template #actions>
        <router-link to="/games/create" class="btn btn-success">➕ Create Game</router-link>
        <button @click="fetchGames" class="btn btn-primary">🔄 Refresh</button>
        <router-link to="/" class="btn btn-secondary">← Back to Dashboard</router-link>
      </template>
    </GameList>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import GameList from '../components/GameList.vue'
import { useSocket } from '../composables/useSocket'

const gameStore = useGameStore()
const { socket } = useSocket()

const games = computed(() => gameStore.games)
const loading = computed(() => gameStore.loading)
const error = computed(() => gameStore.error)

const fetchGames = () => {
  gameStore.fetchGames()
}

const startGame = async (gameId: string) => {
  try {
    await gameStore.startGame(gameId)
    alert(`Game ${gameId} started!`)
  } catch (err) {
    alert(`Failed to start game: ${err}`)
  }
}

const stopGame = async (gameId: string) => {
  try {
    await gameStore.stopGame(gameId)
    alert(`Game ${gameId} stopped!`)
  } catch (err) {
    alert(`Failed to stop game: ${err}`)
  }
}

onMounted(() => {
  fetchGames()
  // Listen for global turn updates and game end events
  socket.value?.on('turn:new', (data: any) => {
    if (data?.gameId && typeof data.turn === 'number') {
      gameStore.updateGameMeta(data.gameId, { currentTurn: data.turn })
    }
  })
  socket.value?.on('game:end', (data: any) => {
    if (data?.gameId) {
      gameStore.updateGameMeta(data.gameId, { status: 'finished' })
    }
  })
})
</script>

<style scoped>
.games-page {
  padding: 20px;
}

.actions {
  margin: 20px 0;
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
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

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
  margin-right: 5px;
}

.loading, .error, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #ef4444;
}

table {
  width: 100%;
  border-collapse: collapse;
}

.status-waiting {
  color: #f59e0b;
  font-weight: 600;
}

.status-finished {
  color: #6b7280;
  font-weight: 600;
}
.socket-indicator {
  font-size: 12px;
  margin-bottom: 10px;
  color: #666;
}
</style>
