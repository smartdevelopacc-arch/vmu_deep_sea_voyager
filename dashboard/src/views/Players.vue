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
          <div class="player-secret">
            <label>Secret:</label>
            <code class="secret-code">{{ player.secret || 'Not set' }}</code>
            <button @click="regenerateSecret(player.code)" class="btn-small btn-generate" title="Generate new secret">
              🎲 Random
            </button>
          </div>
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
import axios from 'axios'

const playerStore = usePlayerStore()

const players = computed(() => playerStore.players)
const loading = computed(() => playerStore.loading)
const error = computed(() => playerStore.error)

const fetchPlayers = () => {
  playerStore.fetchPlayers()
}

const regenerateSecret = async (playerCode: string) => {
  try {
    const response = await axios.post(`/api/players/${playerCode}/regenerate-secret`)
    if (response.data.success) {
      alert(`✅ New secret for ${playerCode}: ${response.data.secret}\n\nCopy this to your bot's .env file as PLAYER_SECRET`)
      // Refresh player list to show new secret
      fetchPlayers()
    }
  } catch (err: any) {
    alert(`❌ Failed to regenerate secret: ${err.response?.data?.error || err.message}`)
  }
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
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}

.player-card {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 15px;
  align-items: center;
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

.player-secret {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-secret label {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.secret-code {
  background: #2d3748;
  color: #10b981;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: 1px;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-generate {
  background: #8b5cf6;
  color: white;
}

.btn-generate:hover {
  background: #7c3aed;
  transform: scale(1.05);
}

code {
  background: #e5e5e5;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}
</style>
