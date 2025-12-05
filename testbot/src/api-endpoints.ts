/**
 * API Endpoints Manager
 * Centralized endpoint management for bot API calls
 */
export class ApiEndpoints {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * GET /game/:gameId/config
   * Fetch static game configuration (terrain, bases, settings)
   */
  getGameConfig(gameId: string, playerId?: string): string {
    const url = `${this.baseUrl}/game/${gameId}/config`;
    return playerId ? `${url}?playerId=${playerId}` : url;
  }

  /**
   * GET /game/:gameId/state
   * Fetch dynamic game state (players, treasures, current turn)
   */
  getGameState(gameId: string, playerId?: string): string {
    const url = `${this.baseUrl}/game/${gameId}/state`;
    return playerId ? `${url}?playerId=${playerId}` : url;
  }

  /**
   * GET /game/:gameId/status
   * Fetch minimal game status (status, currentTurn)
   */
  getGameStatus(gameId: string): string {
    return `${this.baseUrl}/game/${gameId}/status`;
  }

  /**
   * GET /game/:gameId/map
   * Fetch dynamic map state (treasures, owners)
   */
  getGameMap(gameId: string): string {
    return `${this.baseUrl}/game/${gameId}/map`;
  }

  /**
   * GET /game/:gameId/leaderboard
   * Fetch current leaderboard
   */
  getLeaderboard(gameId: string): string {
    return `${this.baseUrl}/game/${gameId}/leaderboard`;
  }

  /**
   * POST /game/:gameId/player/:playerId/move
   * Send move action
   */
  postMove(gameId: string, playerId: string): string {
    return `${this.baseUrl}/game/${gameId}/player/${playerId}/move`;
  }

  /**
   * POST /game/:gameId/player/:playerId/rest
   * Send rest action
   */
  postRest(gameId: string, playerId: string): string {
    return `${this.baseUrl}/game/${gameId}/player/${playerId}/rest`;
  }

  /**
   * POST /game/:gameId/player/:playerId/trap
   * Send trap placement action
   */
  postTrap(gameId: string, playerId: string): string {
    return `${this.baseUrl}/game/${gameId}/player/${playerId}/trap`;
  }
}
