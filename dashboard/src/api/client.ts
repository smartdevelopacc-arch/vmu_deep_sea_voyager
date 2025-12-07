import axios from 'axios'

// ✅ NEW: Get API key from environment variable
const apiKey = import.meta.env.VITE_API_KEY || '';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

// ✅ NEW: Add interceptor to include API key for admin endpoints
apiClient.interceptors.request.use((config) => {
  // Add API key header for admin and player management endpoints
  if (config.url?.includes('/admin/') || config.url?.includes('/players/')) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Admin API endpoints
export const adminAPI = {
  // Health
  health: () => apiClient.get('/admin/health'),
  
  // Games
  getGames: () => apiClient.get('/admin/games'),
  // Use new client endpoint for real-time state instead of worker endpoint
  getGameState: (gameId: string) => apiClient.get(`/game/${gameId}/state`),
  initGame: (data: any) => apiClient.post('/admin/game/init', data),
  startGame: (gameId: string) => apiClient.post(`/admin/game/${gameId}/start`),
  stopGame: (gameId: string) => apiClient.post(`/admin/game/${gameId}/stop`),
  resetGame: (gameId: string) => apiClient.post(`/admin/game/${gameId}/reset`),
  getLoopStatus: (gameId: string) => apiClient.get(`/admin/game/${gameId}/loop-status`),
  
  // Players
  getPlayers: () => apiClient.get('/players'),
  
  // Maps
  getMaps: () => apiClient.get('/maps'),
  getMapById: (mapCode: string) => apiClient.get(`/maps/${mapCode}`)
}

// Game API endpoints
export const gameAPI = {
  getStatus: (gameId: string) => apiClient.get(`/game/${gameId}/status`),
  getMap: (gameId: string) => apiClient.get(`/game/${gameId}/map`),
  getPlayers: (gameId: string) => apiClient.get(`/game/${gameId}/players`),
  getHistory: (gameId: string) => apiClient.get(`/game/${gameId}/history`),
  getLeaderboard: (gameId: string) => apiClient.get(`/game/${gameId}/leaderboard`)
}

export default apiClient
