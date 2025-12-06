/**
 * Shared Types and Interfaces for Test Bot
 */

/**
 * Represents a 2D position on the game map.
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Bot configuration settings.
 */
export interface BotConfig {
  /** Unique identifier for the game to join */
  gameId: string;
  /** Player identifier (matches team code or playerId in game) */
  playerId: string;
  /** Base URL for game API (e.g., 'http://localhost:3000/api') */
  apiUrl: string;
  /** Milliseconds between each action execution */
  actionInterval: number;
}

/**
 * Static game configuration - fetched once at game start, never changes.
 */
export interface GameConfig {
  /** Map dimensions */
  width: number;
  height: number;
  /** Static terrain layout: -1 = island, 0 = sea */
  terrain: number[][];
  /** Base positions for each player (indexed by player number) */
  bases: Position[];
  /** Game settings */
  settings: {
    /** Whether traps are enabled in this game */
    enableTraps?: boolean;
  };
}

/**
 * Dynamic game state - refreshed frequently as game progresses.
 */
export interface GameState {
  /** 2D array of treasure values at each position (changes as treasures are collected) */
  treasures: number[][];
  /** 2D array of wave intensity (0-5) at each position */
  waves: number[][];
  /** All players in the game with current positions and stats */
  players: Array<{
    /** Legacy player code identifier */
    code?: string;
    /** Current player identifier */
    playerId?: string;
    /** Current position on map */
    position: Position;
    /** Current energy level */
    energy: number;
    /** Total score accumulated */
    score: number;
    /** Treasure value currently being carried (0 if none) */
    carriedTreasure?: number;
  }>;
  /** Current turn number */
  currentTurn: number;
  /** Game status: 'waiting', 'playing', or 'finished' */
  status: string;
}
