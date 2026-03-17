import { Request, Response, NextFunction } from 'express';
import { redis } from '../redis';

const WINDOW_SIZE_IN_SECONDS = 60; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP

export async function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `rate_limit:${ip}`;

  try {
    const current = await redis.get(key);
    if (current === null) {
      // First request in the window
      await redis.setex(key, WINDOW_SIZE_IN_SECONDS, '1');
      return next();
    }

    const requestCount = parseInt(current, 10);
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Превышен лимит запросов. Попробуйте через ${WINDOW_SIZE_IN_SECONDS} секунд.`,
      });
    }

    // Increment the counter
    await redis.incr(key);
    // Ensure the key expires (refresh TTL on first increment after creation?)
    // We'll just rely on setex above; but incr doesn't reset TTL, so we need to keep it.
    // Optionally reset TTL only once per window, but for simplicity we can set expiry again.
    await redis.expire(key, WINDOW_SIZE_IN_SECONDS);
    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    // In case of Redis failure, allow the request (fail open)
    next();
  }
}