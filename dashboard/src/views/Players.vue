<template>
  <div class="players-page">
    <h1>👥 Player Management</h1>

    <div class="actions">
      <button @click="fetchPlayers" class="btn btn-primary">🔄 Refresh</button>
    </div>

    <div v-if="loading" class="loading">Loading players...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="players-grid">
      <div v-for="player in players" :key="player.code" class="player-card">
        <div v-if="player.logo" class="player-logo">
          <img :src="player.logo" :alt="player.name" />
        </div>
        <div class="player-info">
          <h3>{{ player.name }}</h3>
          <p class="player-code">Code: {{ player.code }}</p>
          <p class="player-slogan">{{ player.slogan }}</p>
        </div>
      </div>
    </div>

    <div v-if="players.length === 0 && !loading" class="empty">
      <p>No players found. Run: <code>npm run cli import-players</code></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePlayerStore } from '../stores/players'

const playerStore = usePlayerStore()

const players = computed(() => playerStore.players)
const loading = computed(() => playerStore.loading)
const error = computed(() => playerStore.error)

const fetchPlayers = () => {
  playerStore.fetchPlayers()
}

onMounted(() => {
  fetchPlayers()
})
</script>

<style scoped>
.players-page {
  padding: 20px;
}

.actions {
  margin: 20px 0;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.loading, .error, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #ef4444;
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.player-card {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 15px;
  align-items: start;
}

.player-logo img {
  width: 50px;
  height: 50px;
  border-radius: 4px;
}

.player-info {
  flex: 1;
}

.player-info h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
}

.player-code {
  font-size: 12px;
  color: #666;
  margin: 5px 0;
  font-family: monospace;
}

.player-slogan {
  font-style: italic;
  color: #888;
  font-size: 14px;
  margin: 5px 0 0 0;
}

code {
  background: #e5e5e5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
