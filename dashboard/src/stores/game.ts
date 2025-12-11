import { defineStore } from 'pinia'
import { ref } from 'vue'
import { adminAPI } from '../api/client'

// Match backend MAX_TRAPS_PER_PLAYER
const MAX_TRAPS_PER_PLAYER = 5

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

  function syncTrapCounts() {
    if (!currentGame.value?.players || !currentGame.value?.map?.traps) return;
    
    // Count traps per player from actual traps on the map
    const trapCountByPlayer: Record<string, number> = {};
    const trapsArray = Array.isArray(currentGame.value.map.traps)
      ? currentGame.value.map.traps
      : Object.values(currentGame.value.map.traps);
    
    trapsArray.forEach((trap: any) => {
      const owner = trap.playerId || trap[3];
      if (owner) {
        trapCountByPlayer[owner] = (trapCountByPlayer[owner] || 0) + 1;
      }
    });
    
    // Update each player's trapCount with actual count from board
    currentGame.value.players.forEach((player: any) => {
      const playerId = player.playerId || player.code;
      const actualCount = trapCountByPlayer[playerId] || 0;
      // Set to actual count, cap at MAX_TRAPS_PER_PLAYER
      player.trapCount = Math.min(actualCount, MAX_TRAPS_PER_PLAYER);
      
      if (actualCount > MAX_TRAPS_PER_PLAYER) {
        console.warn(`⚠️ Player ${playerId} has ${actualCount} traps but max is ${MAX_TRAPS_PER_PLAYER}!`);
      }
    });
    
    console.log('🪤 Trap counts synced from actual board state:', trapCountByPlayer);
  }

  async function fetchGameState(gameId: string) {
    loading.value = true
    error.value = null
    try {
      // Single call contains runtime state (treasures, traps, owners) + map dims
      const stateResponse = await adminAPI.getGameState(gameId)
      const state = stateResponse.data
      console.log('🔍 State response:', state)
      
      currentGame.value = {
        gameId,
        currentTurn: state.currentTurn,
        status: state.status,
        startTime: state.startTime, // ✅ ADDED: Capture startTime
        startedAt: state.startedAt, // ✅ ADDED: Capture startedAt
        players: state.players || [],
        map: {
          width: state.map?.width,
          height: state.map?.height,
          obstacles: state.map?.terrain,
          treasures: state.treasures,
          waves: state.map?.waves || [],
          bases: state.map?.bases,
          traps: state.traps || [] // runtime traps
        }
      }
      
      console.log('🔍 currentGame.value.map:', currentGame.value.map)
      console.log(`✅ Game state loaded: ${currentGame.value.players.length} players, ${state.map?.width}x${state.map?.height} map`)
      
      // Cap all player trapCounts at MAX_TRAPS_PER_PLAYER to prevent display overflow
      currentGame.value.players.forEach((player: any) => {
        if (player.trapCount && player.trapCount > MAX_TRAPS_PER_PLAYER) {
          console.warn(`⚠️ Player ${player.code || player.playerId} trapCount ${player.trapCount} exceeds max ${MAX_TRAPS_PER_PLAYER}, capping it`);
          player.trapCount = MAX_TRAPS_PER_PLAYER;
        }
      });
      
      // Sync trap counts from actual board state
      syncTrapCounts()
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

  async function deleteGame(gameId: string) {
    try {
      await adminAPI.deleteGame(gameId)
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
    deleteGame,
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
      
      // Sync trap counts from actual board state
      syncTrapCounts();
    },
    removeTrap(position: { x: number; y: number }) {
      if (!currentGame.value?.map?.traps) return;
      
      // Remove trap from map
      if (Array.isArray(currentGame.value.map.traps)) {
        currentGame.value.map.traps = currentGame.value.map.traps.filter((t: any) => {
          const tx = t.position?.x ?? t[0];
          const ty = t.position?.y ?? t[1];
          return !(tx === position.x && ty === position.y);
        });
      } else {
        const key = `${position.x},${position.y}`;
        delete currentGame.value.map.traps[key];
      }
      
      console.log(`🧹 Trap removed at (${position.x}, ${position.y})`);
      
      // Sync trap counts from actual board state
      syncTrapCounts();
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
