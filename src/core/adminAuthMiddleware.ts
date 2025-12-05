import { Request, Response, NextFunction } from 'express';

/**
 * ✅ Middleware to validate API key for admin endpoints
 * 
 * Requires:
 * - req.headers['x-api-key']: Admin API key
 * 
 * Validates that the provided API key matches the server's API_KEY environment variable
 */
export const validateAdminApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const serverApiKey = process.env.API_KEY;

    // Check if API key is configured
    if (!serverApiKey) {
      console.error('⚠️ API_KEY not configured in environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check if API key is provided
    if (!apiKey) {
      return res.status(401).json({ error: 'Missing x-api-key header' });
    }

    // Validate API key matches
    if (apiKey !== serverApiKey) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    // API key is valid, proceed
    next();
  } catch (error: any) {
    console.error('Admin authentication error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
