import { Request, Response, NextFunction } from "express";
import { redis } from "../redis";

const WINDOW_SIZE_IN_SECONDS = 60; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP

// Fallback: если Redis недоступен, используем встроенный счётчик в памяти
const memoryLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `rate_limit:${ip}`;
  const now = Date.now();

  try {
    const current = await redis.get(key);
    if (current === null) {
      // First request in the window
      await redis.setex(key, WINDOW_SIZE_IN_SECONDS, "1");
      return next();
    }

    const requestCount = parseInt(current, 10);
    if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        error: "Слишком много запросов от этого IP-адреса.",
        message: `Превышен лимит запросов. Попробуйте через ${WINDOW_SIZE_IN_SECONDS} секунд.`,
      });
    }

    // Увеличиваем счётчик (TTL не сбрасывается)
    await redis.incr(key);
    next();
  } catch (error) {
    console.error("Rate limit error (Redis unavailable):", error);

    // Fail-closed: используем fallback в памяти, но блокируем при превышении лимита
    const memoryEntry = memoryLimitStore.get(ip);

    if (memoryEntry && memoryEntry.resetAt > now) {
      memoryEntry.count++;
      if (memoryEntry.count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
          error: "Слишком много запросов от этого IP-адреса.",
          message: `Превышен лимит запросов. Попробуйте через ${Math.ceil((memoryEntry.resetAt - now) / 1000)} секунд.`,
        });
      }
    } else {
      memoryLimitStore.set(ip, {
        count: 1,
        resetAt: now + WINDOW_SIZE_IN_SECONDS * 1000,
      });
    }

    next();
  }
}

// Очистка устаревших записей каждые 5 минут
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryLimitStore.entries()) {
      if (entry.resetAt < now) {
        memoryLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);
