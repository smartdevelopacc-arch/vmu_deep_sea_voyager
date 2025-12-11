import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

export function useSocket() {
  const socket = ref<Socket | null>(null)
  const connected = ref(false)

  onMounted(() => {
    const baseUrl = (import.meta as any).env?.VITE_SOCKET_URL || window.location.origin
    socket.value = io(baseUrl, { 
      auth: { token: 'VALID_SECRET_TOKEN_123' },
      transports: ['websocket', 'polling']
    })
    
    socket.value.on('connect', () => {
      connected.value = true
      console.log('✅ Socket connected')
    })

    socket.value.on('disconnect', () => {
      connected.value = false
      console.log('❌ Socket disconnected')
    })
  })

  onUnmounted(() => {
    socket.value?.disconnect()
  })

  return {
    socket,
    connected
  }
}

export function useGameSocket(gameId: string, store: any, onAnyEvent?: (evt: any) => void) {
  const { socket, connected } = useSocket()

  onMounted(() => {
    if (!socket.value) return
    socket.value.emit('register', { gameId, playerId: 'observer' })

    // Turn updates
    socket.value.on('turn:new', (data) => {
      if (data?.gameId === gameId) {
        store.updateTurn(data.turn)
        onAnyEvent?.(data)
      }
    })

    // Tick completion (can fetch diff later if needed)
    socket.value.on('game:tick:complete', (data) => {
      if (data?.gameId === gameId) {
        // Minimal action: already handled by move/energy events
        onAnyEvent?.(data)
      }
    })

    socket.value.on('player:position:changed', (data) => {
      if (data?.gameId === gameId) {
        store.updatePlayerPosition(data.playerId, data.position)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('player:energy:changed', (data) => {
      if (data?.gameId === gameId) {
        store.updatePlayerEnergy(data.playerId, data.energy)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('player:score:changed', (data) => {
      if (data?.gameId === gameId) {
        store.updatePlayerScore(data.playerId, data.score)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('score:update', (data) => {
      if (data?.gameId === gameId) {
        store.applyScores(data.scores)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('treasure:collected', (data) => {
      if (data?.gameId === gameId) {
        store.applyTreasureCollected(data.playerId, data.treasure, data.position)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('treasure:dropped', (data) => {
      if (data?.gameId === gameId) {
        // Clear carried treasure when dropped at base
        const player = store.currentGame?.players?.find((p: any) => 
          p.playerId === data.playerId || p.code === data.playerId
        )
        if (player) {
          player.carriedTreasure = 0
          console.log(`📦 Player ${data.playerId} dropped treasure at base`)
        }
        onAnyEvent?.(data)
      }
    })

    socket.value.on('player:treasure:changed', (data) => {
      if (data?.gameId === gameId) {
        const player = store.currentGame?.players?.find((p: any) => 
          p.playerId === data.playerId || p.code === data.playerId
        )
        if (player) {
          player.carriedTreasure = data.carriedTreasure || 0
          console.log(`💎 Player ${data.playerId} treasure updated to: ${data.carriedTreasure}`)
        }
        onAnyEvent?.(data)
      }
    })

    socket.value.on('trap:placed', (data) => {
      if (data?.gameId === gameId) {
        store.addTrap(data.playerId, data.position, data.danger)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('trap:removed', (data) => {
      if (data?.gameId === gameId && data.position) {
        store.removeTrap(data.position)
        onAnyEvent?.(data)
      }
    })

    socket.value.on('game:end', (data) => {
      if (data?.gameId === gameId) {
        console.log('🏁 Game ended!', data.result)
        console.log('🏁 Final scores with lastScoreTime:', data.result?.scores)
        // Update game status to finished
        if (store.currentGame) {
          store.currentGame.status = 'finished'
          // Persist final scores for leaderboard display after finish
          ;(store.currentGame as any).finalScores = data.result?.scores || []
          console.log('🏁 Saved finalScores to store:', (store.currentGame as any).finalScores)
        }
        // Trigger any event handler
        onAnyEvent?.(data)
        // Optionally show alert or notification
        // alert(`Game finished!\nFinal scores: ${JSON.stringify(data.result.scores, null, 2)}`)
      }
    })
  })

  return { socket, connected }
}
