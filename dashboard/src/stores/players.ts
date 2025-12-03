import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminAPI } from '../api/client'

export const usePlayerStore = defineStore('players', () => {
  const players = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPlayers() {
    loading.value = true
    error.value = null
    try {
      const response = await adminAPI.getPlayers()
      players.value = response.data.players
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return {
    players,
    loading,
    error,
    fetchPlayers
  }
})
