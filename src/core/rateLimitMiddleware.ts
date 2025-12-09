import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiter for player actions
 * Tracks actions per player per second
 */
interface PlayerActionCount {
  count: number;
  resetTime: number;
}

const playerActionCounts = new Map<string, PlayerActionCount>();

/**
 * Get rate limit from environment
 * Default: 5 actions per second per player
 */
const ACTIONS_PER_SECOND = parseInt(process.env.PLAYER_ACTIONS_PER_SECOND || '5');
const RATE_LIMIT_WINDOW = 1000; // 1 second in milliseconds

/**
 * Rate limit middleware for player actions
 * Limits actions per player to ACTIONS_PER_SECOND per second
 */
export const rateLimitPlayerActions = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { playerId, gameId } = req.params;
    
    if (!playerId || !gameId) {
      return res.status(400).json({ error: 'Missing playerId or gameId' });
    }

    // Use both gameId and playerId as key to allow per-game limits
    const key = `${gameId}:${playerId}`;
    const now = Date.now();

    let actionData = playerActionCounts.get(key);

    // Initialize or reset if window has expired
    if (!actionData || now >= actionData.resetTime) {
      actionData = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW
      };
    }

    // Increment action count
    actionData.count++;

    // Check if limit exceeded
    if (actionData.count > ACTIONS_PER_SECOND) {
      playerActionCounts.set(key, actionData);
      
      const waitTime = Math.ceil((actionData.resetTime - now) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many actions. Max ${ACTIONS_PER_SECOND} actions per second`,
        retryAfter: waitTime
      });
    }

    // Update count
    playerActionCounts.set(key, actionData);

    // Add rate limit info to response headers
    res.set('X-RateLimit-Limit', ACTIONS_PER_SECOND.toString());
    res.set('X-RateLimit-Remaining', (ACTIONS_PER_SECOND - actionData.count).toString());
    res.set('X-RateLimit-Reset', actionData.resetTime.toString());

    next();
  } catch (error: any) {
    console.error('Rate limit middleware error:', error.message);
    // On error, allow the request to proceed
    next();
  }
};

/**
 * Clean up old entries from rate limit map to prevent memory leak
 * Run periodically (e.g., every 30 seconds)
 */
export const cleanupRateLimitMap = () => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, data] of playerActionCounts.entries()) {
    if (now > data.resetTime + 5000) { // Clean entries 5 seconds after reset
      playerActionCounts.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[RateLimit] Cleaned up ${cleanedCount} expired entries`);
  }
};

/**
 * Start periodic cleanup
 */
export const startRateLimitCleanup = () => {
  setInterval(cleanupRateLimitMap, 30000); // Cleanup every 30 seconds
  console.log(`[RateLimit] Initialized with limit: ${ACTIONS_PER_SECOND} actions/second (window: ${RATE_LIMIT_WINDOW}ms)`);
};
