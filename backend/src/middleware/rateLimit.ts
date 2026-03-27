import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import ipaddr from "ipaddr.js";

const WINDOW_SIZE_IN_SECONDS = 60; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100; // 100 requests per minute per IP

// Fallback: если Redis недоступен, используем встроенный счётчик в памяти
const memoryLimitStore = new Map<string, { count: number; resetAt: number }>();

// Список доверенных прокси-подсетей (локальная сеть, Docker, CDN)
const TRUSTED_PROXY_RANGES = [
  "127.0.0.1", // localhost IPv4
  "::1", // localhost IPv6
  "10.0.0.0/8", // Private Class A
  "172.16.0.0/12", // Private Class B
  "192.168.0.0/16", // Private Class C
  "fc00::/7", // IPv6 unique local
];

// Проверка: принадлежит ли IP к доверенной подсети
function isTrustedProxy(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);

    for (const range of TRUSTED_PROXY_RANGES) {
      const [subnet, prefixStr] = range.split("/");
      const subnetAddr = ipaddr.parse(subnet);

      if (addr.kind() === subnetAddr.kind()) {
        const prefix = parseInt(prefixStr, 10);
        if (
          (addr as ipaddr.IPv4 | ipaddr.IPv6).match(
            subnetAddr as ipaddr.IPv4 | ipaddr.IPv6,
            prefix,
          )
        ) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

// Получение реального IP клиента с учётом доверенных прокси
function getClientIp(req: Request): string {
  const remoteIp = req.socket.remoteAddress || "unknown";

  // Если подключение от доверенного прокси — берём IP из заголовка
  if (isTrustedProxy(remoteIp)) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      // Первый IP в списке — оригинальный клиент
      return forwarded.split(",")[0].trim();
    }

    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string") {
      return realIp;
    }
  }

  // Иначе — берём реальный IP подключения
  return remoteIp;
}

// Нормализация IP: преобразует IPv4-mapped IPv6 адреса в IPv4
function normalizeIp(ip: string): string {
  // IPv4-mapped IPv6 адрес вида ::ffff:192.168.1.1 → 192.168.1.1
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (ipv4Mapped) {
    return ipv4Mapped[1];
  }
  // IPv6 localhost ::1 → 127.0.0.1
  if (ip === "::1") {
    return "127.0.0.1";
  }
  return ip;
}

export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const rawIp = getClientIp(req);
  const ip = normalizeIp(rawIp);
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

    // Упрощённый memory fallback с ленивым удалением устаревших записей
    const memoryEntry = memoryLimitStore.get(ip);
    const windowMs = WINDOW_SIZE_IN_SECONDS * 1000;

    // Если запись есть, но устарела — удаляем её
    if (memoryEntry && memoryEntry.resetAt <= now) {
      memoryLimitStore.delete(ip);
    }

    // Получаем актуальную запись (после возможного удаления)
    const currentEntry = memoryLimitStore.get(ip);

    if (currentEntry) {
      // Запись активна, увеличиваем счётчик
      currentEntry.count++;
      if (currentEntry.count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(429).json({
          error: "Слишком много запросов от этого IP-адреса.",
          message: `Превышен лимит запросов. Попробуйте через ${Math.ceil((currentEntry.resetAt - now) / 1000)} секунд.`,
        });
      }
    } else {
      // Нет активной записи, создаём новую
      memoryLimitStore.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });
    }

    next();
  }
}
