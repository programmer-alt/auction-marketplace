import { LRUCache } from "lru-cache";
import type { Socket } from "socket.io";

interface ErrorWithData extends Error {
  data?: { code: string; event?: string };
}

// Конфигурация rate limiting для WebSocket
const WS_CONNECTION_LIMIT = 10; // Максимум подключений с одного IP
const WS_CONNECTION_WINDOW = 60; // 60 секунд
const WS_BID_LIMIT = 1; // 1 ставка
const WS_BID_WINDOW = 5; // 5 секунд

// Memory store для WebSocket rate limiting
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
 * Проверка rate limit с использованием memory store
 */
function checkRateLimitMemory(
  key: string,
  limit: number,
  windowSeconds: number,
): { allowed: boolean; remaining: number; resetAfter: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let record = wsMemoryStore.get(key);
  if (!record) {
    record = { count: 0, resetAt: now + windowMs };
    wsMemoryStore.set(key, record);
  }

  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count++;
  wsMemoryStore.set(key, record);

  return {
    allowed: true,
    remaining: limit - record.count,
    resetAfter: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Middleware для ограничения количества подключений с одного IP
 */
export async function socketConnectionRateLimit(socket: Socket, next: (err?: Error) => void) {
  const ip = getSocketIp(socket);
  const key = `connection:${ip}`;

  const result = checkRateLimitMemory(key, WS_CONNECTION_LIMIT, WS_CONNECTION_WINDOW);

  if (!result.allowed) {
    const error = new Error(
      `Too many connections from this IP. Try again in ${result.resetAfter} seconds.`,
    ) as ErrorWithData;
    error.data = { code: "TOO_MANY_CONNECTIONS" };
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
    const error = new Error("Authentication required for bidding") as ErrorWithData;
    error.data = { code: "UNAUTHORIZED" };
    return next(error);
  }

  const key = `bid:${user.id}`;
  const result = checkRateLimitMemory(key, WS_BID_LIMIT, WS_BID_WINDOW);

  if (!result.allowed) {
    const error = new Error(
      `Too many bids. Please wait ${result.resetAfter} seconds before placing another bid.`,
    ) as ErrorWithData;
    error.data = { code: "TOO_MANY_BIDS" };
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

    const result = checkRateLimitMemory(key, limit, windowSeconds);

    if (!result.allowed) {
      const error = new Error(
        `Rate limit exceeded for event "${eventName}". Try again in ${result.resetAfter} seconds.`,
      ) as ErrorWithData;
      error.data = { code: "RATE_LIMIT_EXCEEDED", event: eventName };
      return next(error);
    }

    next();
  };
}
