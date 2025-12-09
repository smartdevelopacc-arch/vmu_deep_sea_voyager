<template>
  <div class="game-list">
    <div class="actions">
      <slot name="actions"></slot>
    </div>
    <div v-if="loading" class="loading">Loading games...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="games.length > 0" class="games-table">
      <table>
        <thead>
          <tr>
            <th>Game ID</th>
            <th>Status</th>
            <th>Turn</th>
            <th>Players</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="game in games" :key="game.gameId">
            <td><code>{{ game.gameId }}</code></td>
            <td><span :class="'status-' + game.status">{{ game.status }}</span></td>
            <td>{{ game.currentTurn }}</td>
            <td>{{ game.playerCount }}</td>
            <td>{{ game.isActive ? '✅' : '❌' }}</td>
            <td class="row-actions">
              <router-link :to="`/game/${game.gameId}`" class="btn btn-sm btn-primary">View</router-link>
              <button v-if="!game.isActive && game.status !== 'finished'" @click="$emit('start', game.gameId)" class="btn btn-sm btn-success">▶️</button>
              <button v-if="game.isActive" @click="$emit('stop', game.gameId)" class="btn btn-sm btn-danger">⏹️</button>
              <button @click="$emit('delete', game.gameId)" class="btn btn-sm btn-delete" title="Delete game">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty">No games found.</div>
  </div>
</template>

<script setup lang="ts">
interface GameMeta {
  gameId: string;
  status: string;
  currentTurn: number;
  playerCount: number;
  isActive: boolean;
}

defineProps<{ games: GameMeta[]; loading: boolean; error: string | null }>()
</script>

<style scoped>
.game-list { width: 100%; }
.actions { margin: 10px 0; display: flex; gap: 10px; flex-wrap: wrap; }
.loading, .error, .empty { text-align: center; padding: 30px; color: #666; }
.error { color: #ef4444; }
.table-refresh { margin-bottom: 10px; }
.table-actions { display: flex; gap: 8px; }
.games-table table { width: 100%; border-collapse: collapse; }
th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
th { background: #f5f5f5; font-weight: 600; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
.status-playing { color: #22c55e; font-weight: 600; }
.status-waiting { color: #f59e0b; font-weight: 600; }
.status-finished { color: #6b7280; font-weight: 600; }
.btn { padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-primary { background: #3b82f6; color: white; }
.btn-success { background: #22c55e; color: white; }
.btn-danger { background: #ef4444; color: white; }
.btn-delete { background: #dc2626; color: white; }
.btn-delete:hover { background: #b91c1c; }
.row-actions { display: flex; gap: 4px; }
</style>
