import { Socket } from "socket.io";
import { redis } from "../config/redis";
import { LRUCache } from "lru-cache";

// Конфигурация rate limiting для WebSocket
const WS_CONNECTION_LIMIT = 10; // Максимум подключений с одного IP
const WS_CONNECTION_WINDOW = 60; // 60 секунд
const WS_BID_LIMIT = 1; // 1 ставка
const WS_BID_WINDOW = 5; // 5 секунд

// Memory fallback для WebSocket rate limiting
const wsMemoryStore = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10_000,
  ttl: Math.max(WS_CONNECTION_WINDOW, WS_BID_WINDOW) * 1000,
  ttlAutopurge: false,
});

/**
 * Получение IP клиента из socket
 */
function getSocketIp(socket: Socket): string {
  const remoteIp = socket.handshake.address;
  // Нормализация IPv4-mapped IPv6 адресов
  const ipv4Mapped = remoteIp.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) {
    return ipv4Mapped[1];
  }
  if (remoteIp === "::1") {
    return "127.0.0.1";
  }
  return remoteIp;
}

/**
 * Проверка rate limit с fallback на память
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAfter: number }> {
  const now = Date.now();
  const redisKey = `ws:rate_limit:${key}`;

  try {
    // Пытаемся использовать Redis
    const current = await redis.get(redisKey);
    if (current === null) {
      // Первый запрос в окне
      await redis.setex(redisKey, windowSeconds, "1");
      return {
        allowed: true,
        remaining: limit - 1,
        resetAfter: windowSeconds,
      };
    }

    const requestCount = parseInt(current, 10);
    if (requestCount >= limit) {
      const ttl = await redis.ttl(redisKey);
      return {
        allowed: false,
        remaining: 0,
        resetAfter: ttl > 0 ? ttl : windowSeconds,
      };
    }

    // Увеличиваем счётчик
    await redis.incr(redisKey);
    return {
      allowed: true,
      remaining: limit - requestCount - 1,
      resetAfter: windowSeconds,
    };
  } catch (error) {
    console.error("WebSocket Redis rate limit error, falling back to memory:", error);
    
    // Memory fallback
    const memoryKey = `memory:${key}`;
    const currentEntry = wsMemoryStore.get(memoryKey);
    
    if (currentEntry) {
      if (currentEntry.resetAt < now) {
        // Окно истекло, сбрасываем
        wsMemoryStore.set(memoryKey, { count: 1, resetAt: now + windowSeconds * 1000 });
        return {
          allowed: true,
          remaining: limit - 1,
          resetAfter: windowSeconds,
        };
      }
      
      currentEntry.count++;
      if (currentEntry.count > limit) {
        const resetAfter = Math.ceil((currentEntry.resetAt - now) / 1000);
        return {
          allowed: false,
          remaining: 0,
          resetAfter,
        };
      }
      
      wsMemoryStore.set(memoryKey, currentEntry);
      return {
        allowed: true,
        remaining: limit - currentEntry.count,
        resetAfter: Math.ceil((currentEntry.resetAt - now) / 1000),
      };
    } else {
      wsMemoryStore.set(memoryKey, { count: 1, resetAt: now + windowSeconds * 1000 });
      return {
        allowed: true,
        remaining: limit - 1,
        resetAfter: windowSeconds,
      };
    }
  }
}

/**
 * Middleware для ограничения количества подключений с одного IP
 */
export async function socketConnectionRateLimit(socket: Socket, next: (err?: Error) => void) {
  const ip = getSocketIp(socket);
  const key = `connection:${ip}`;
  
  const result = await checkRateLimit(key, WS_CONNECTION_LIMIT, WS_CONNECTION_WINDOW);
  
  if (!result.allowed) {
    const error = new Error(`Too many connections from this IP. Try again in ${result.resetAfter} seconds.`);
    (error as any).data = { code: "TOO_MANY_CONNECTIONS" };
    return next(error);
  }
  
  next();
}

/**
 * Middleware для ограничения частоты ставок
 */
export async function socketBidRateLimit(socket: Socket, next: (err?: Error) => void) {
  const user = socket.data.user;
  if (!user) {
    // Гости не могут делать ставки
    const error = new Error("Authentication required for bidding");
    (error as any).data = { code: "UNAUTHORIZED" };
    return next(error);
  }
  
  const key = `bid:${user.id}`;
  const result = await checkRateLimit(key, WS_BID_LIMIT, WS_BID_WINDOW);
  
  if (!result.allowed) {
    const error = new Error(`Too many bids. Please wait ${result.resetAfter} seconds before placing another bid.`);
    (error as any).data = { code: "TOO_MANY_BIDS" };
    return next(error);
  }
  
  next();
}

/**
 * Фабрика middleware для конкретных событий
 */
export function createSocketEventRateLimit(eventName: string, limit: number, windowSeconds: number) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    const user = socket.data.user;
    const ip = getSocketIp(socket);
    
    // Используем userId если есть, иначе IP
    const identifier = user ? `user:${user.id}` : `ip:${ip}`;
    const key = `event:${eventName}:${identifier}`;
    
    const result = await checkRateLimit(key, limit, windowSeconds);
    
    if (!result.allowed) {
      const error = new Error(`Rate limit exceeded for event "${eventName}". Try again in ${result.resetAfter} seconds.`);
      (error as any).data = { code: "RATE_LIMIT_EXCEEDED", event: eventName };
      return next(error);
    }
    
    next();
  };
}