import { Request, Response, NextFunction } from "express";
import { redis } from "../redis";

const WINDOW_SIZE_IN_SECONDS = 60; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP

export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = `rate_limit:${ip}`;

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
        error: "Слишком много запросов  от этого IP-адреса.",
        message: `Превышен лимит запросов. Попробуйте через ${WINDOW_SIZE_IN_SECONDS} секунд.`,
      });
    }

    // Увеличиваем счётчик (TTL не сбрасывается)
    await redis.incr(key);
    next();
  } catch (error) {
    console.error("Rate limit error:", error);
    // Если что-то пошло не так, пропускаем запрос
    res.status(500).json({ error: "Что-то пошло не так" });
    next();
  }
}
