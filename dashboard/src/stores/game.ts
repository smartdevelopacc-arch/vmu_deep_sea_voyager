import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminAPI } from '../api/client'
import apiClient from '../api/client'

export const useGameStore = defineStore('games', () => {
  const games = ref<any[]>([])
  const currentGame = ref<any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchGames() {
    loading.value = true
    error.value = null
    try {
      const response = await adminAPI.getGames()
      games.value = response.data.games
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function fetchGameState(gameId: string) {
    loading.value = true
    error.value = null
    try {
      // Fetch from new client API endpoint
      const [stateResponse, configResponse] = await Promise.all([
        adminAPI.getGameState(gameId),
        apiClient.get(`/game/${gameId}/config`)
      ])
      
      // State response: { currentTurn, status, treasures, owners, players }
      const state = stateResponse.data
      // Config response: { width, height, terrain, waves, bases, settings }
      const config = configResponse.data
      
      console.log('🔍 State response:', state)
      console.log('🔍 Config response:', config)
      
      currentGame.value = {
        gameId,
        currentTurn: state.currentTurn,
        status: state.status,
        players: state.players || [],
        map: {
          width: config.width,
          height: config.height,
          obstacles: config.terrain,
          treasures: state.treasures,
          waves: config.waves || [],
          bases: config.bases,
          traps: {} // Will be populated by socket events
        }
      }
      
      console.log('🔍 currentGame.value.map:', currentGame.value.map)
      console.log(`✅ Game state loaded: ${currentGame.value.players.length} players, ${config.width}x${config.height} map`)
    } catch (err: any) {
      error.value = err.message
      console.error('❌ Error fetching game state:', err)
    } finally {
      loading.value = false
    }
  }

  async function startGame(gameId: string) {
    try {
      await adminAPI.startGame(gameId)
      await fetchGames()
    } catch (err: any) {
      error.value = err.message
      throw err
    }
  }

  async function stopGame(gameId: string) {
    try {
      await adminAPI.stopGame(gameId)
      await fetchGames()
    } catch (err: any) {
      error.value = err.message
      throw err
    }
  }

  async function resetGame(gameId: string) {
    try {
      await adminAPI.resetGame(gameId)
      await fetchGameState(gameId) // Refresh state after reset
    } catch (err: any) {
      error.value = err.message
      throw err
    }
  }

  return {
    games,
    currentGame,
    loading,
    error,
    fetchGames,
    fetchGameState,
    startGame,
    stopGame,
    resetGame,
    /** Incremental updates (socket-driven) */
    updateTurn(turn: number) {
      if (!currentGame.value) return;
      currentGame.value.currentTurn = turn;
    },
    updatePlayerPosition(playerId: string, position: { x: number; y: number }) {
      if (!currentGame.value?.players) return;
      const player = currentGame.value.players.find((p: any) => p.playerId === playerId || p.code === playerId);
      if (player) {
        player.position = position;
      }
    },
    updatePlayerEnergy(playerId: string, energy: number) {
      if (!currentGame.value?.players) return;
      const player = currentGame.value.players.find((p: any) => p.playerId === playerId || p.code === playerId);
      if (player) {
        player.energy = energy;
      }
    },
    updatePlayerScore(playerId: string, score: number) {
      if (!currentGame.value?.players) return;
      const player = currentGame.value.players.find((p: any) => p.playerId === playerId || p.code === playerId);
      if (player) {
        player.score = score;
      }
    },
    applyScores(scores: Array<{ playerId: string; score: number }>) {
      if (!currentGame.value?.players) return;
      scores.forEach(s => {
        const player = currentGame.value.players.find((p: any) => p.playerId === s.playerId || p.code === s.playerId);
        if (player) player.score = s.score;
      });
    },
    applyTreasureCollected(playerId: string, treasure: number, position?: { x: number; y: number }) {
      if (!currentGame.value) return;
      
      // Update player's carried treasure
      const player = currentGame.value.players?.find((p: any) => p.playerId === playerId || p.code === playerId);
      if (player) {
        player.carriedTreasure = treasure;
        console.log(`💎 Player ${playerId} now carrying treasure ${treasure}`);
      }
      
      // Remove treasure from map
      if (position && currentGame.value.map?.treasures?.[position.y]) {
        const oldValue = currentGame.value.map.treasures[position.y][position.x];
        currentGame.value.map.treasures[position.y][position.x] = 0;
        console.log(`💎 Treasure at (${position.x}, ${position.y}) removed: ${oldValue} → 0`);
      }
    },
    addTrap(playerId: string, position: { x: number; y: number }, danger: number) {
      if (!currentGame.value?.map) return;
      // Initialize traps as object if not exists
      if (!currentGame.value.map.traps) {
        currentGame.value.map.traps = {};
      }
      // Convert to object if it's an array
      if (Array.isArray(currentGame.value.map.traps)) {
        const trapsObj: any = {};
        currentGame.value.map.traps.forEach((t: any) => {
          const key = `${t.position.x},${t.position.y}`;
          trapsObj[key] = t;
        });
        currentGame.value.map.traps = trapsObj;
      }
      // Add new trap
      const key = `${position.x},${position.y}`;
      currentGame.value.map.traps[key] = { playerId, position, danger };
      console.log(`🪤 Trap added at (${position.x}, ${position.y}) danger=${danger}`);
    },
    // Update a game item in list without refetch
    updateGameMeta(gameId: string, patch: Record<string, any>) {
      const idx = games.value.findIndex(g => g.gameId === gameId);
      if (idx !== -1) {
        games.value[idx] = { ...games.value[idx], ...patch };
      }
      // Sync currentGame if matching
      if (currentGame.value && currentGame.value.gameId === gameId) {
        Object.assign(currentGame.value, patch);
      }
    }
  }
})
