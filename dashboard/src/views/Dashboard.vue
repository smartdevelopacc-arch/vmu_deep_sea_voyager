<template>
  <div class="dashboard">
    <h1>🎮 Deep Sea Voyager - Admin Dashboard</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Games</h3>
        <p class="stat-value">{{ games.length }}</p>
      </div>
      
      <div class="stat-card">
        <h3>Active Games</h3>
        <p class="stat-value">{{ activeGames }}</p>
      </div>
      
      <div class="stat-card">
        <h3>Total Players</h3>
        <p class="stat-value">{{ players.length }}</p>
      </div>
      
      <div class="stat-card">
        <h3>Socket Status</h3>
        <p class="stat-value" :class="{ 'connected': connected, 'disconnected': !connected }">
          {{ connected ? '🟢 Connected' : '🔴 Disconnected' }}
        </p>
      </div>
    </div>

    <div class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="action-buttons">
        <router-link to="/games" class="btn btn-primary">📋 View Games</router-link>
        <router-link to="/players" class="btn btn-primary">👥 Manage Players</router-link>
        <button @click="refreshData" class="btn btn-secondary">🔄 Refresh Data</button>
      </div>
    </div>

    <div class="recent-games" v-if="games.length > 0">
      <h2>Recent Games</h2>
      <table>
        <thead>
          <tr>
            <th>Game ID</th>
            <th>Status</th>
            <th>Turn</th>
            <th>Players</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="game in recentGames" :key="game.gameId">
            <td>{{ game.gameId }}</td>
            <td><span :class="'status-' + game.status">{{ game.status }}</span></td>
            <td>{{ game.currentTurn }}</td>
            <td>{{ game.playerCount }}</td>
            <td>
              <router-link :to="`/game/${game.gameId}`" class="btn btn-sm">View</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useGameStore } from '../stores/game'
import { usePlayerStore } from '../stores/players'
import { useSocket } from '../composables/useSocket'

const gameStore = useGameStore()
const playerStore = usePlayerStore()
const { connected } = useSocket()

const games = computed(() => gameStore.games)
const players = computed(() => playerStore.players)
const activeGames = computed(() => games.value.filter(g => g.status === 'playing').length)
const recentGames = computed(() => games.value.slice(0, 5))

const refreshData = async () => {
  await Promise.all([
    gameStore.fetchGames(),
    playerStore.fetchPlayers()
  ])
}

onMounted(() => {
  refreshData()
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

h1 {
  margin-bottom: 30px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin: 0;
}

.connected {
  color: #22c55e;
}

.disconnected {
  color: #ef4444;
}

.quick-actions {
  margin-bottom: 40px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
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

.btn-sm {
  padding: 5px 10px;
  font-size: 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background: #f5f5f5;
  font-weight: 600;
}

.status-playing {
  color: #22c55e;
  font-weight: 600;
}

.status-waiting {
  color: #f59e0b;
  font-weight: 600;
}

.status-finished {
  color: #6b7280;
  font-weight: 600;
}
</style>
