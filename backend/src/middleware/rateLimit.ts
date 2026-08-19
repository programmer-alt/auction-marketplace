import { Request, Response, NextFunction } from "express";
import ipaddr from "ipaddr.js";
import { LRUCache } from "lru-cache";

const WINDOW_SIZE_IN_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = process.env.NODE_ENV === 'development' 
  ? parseInt(process.env.DEV_RATE_LIMIT || '1000', 10)
  : parseInt(process.env.PROD_RATE_LIMIT || '100', 10);

// ponytail: увеличиваем TTL для fallback, чтобы записи не терялись при кратковременных отключениях
// включаем автоочистку (ttlAutopurge: true), чтобы записи не накапливались
const memoryLimitStore = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10_000,           // максимум 10k уникальных IP
  ttl: WINDOW_SIZE_IN_SECONDS * 1000,
  ttlAutopurge: true,    // ponytail: включаем автоочистку
});

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

// ponytail: функция для логирования только при кратных значениях (100, 200, 500, 900)
// чтобы не засорять консоль
function shouldLogRequestCount(requestCount: number): boolean {
  const logPoints = [100, 200, 500, 900];
  return logPoints.includes(requestCount);
}

export async function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // ponytail: Исключаем /api/csrf-token, /api/auth/me и /uploads/* из rate limiting 
  // - это GET-запросы для генерации токена, проверки аутентификации и статических ресурсов
  if (
    req.path === '/api/csrf-token' || 
    req.path === '/api/auth/me' ||
    req.path === '/api/upload' ||
    req.path === '/uploads' ||
    req.path.startsWith('/uploads/')
  ) return next();

  // Добавляем условные исключения для разработки
  if (process.env.NODE_ENV !== 'production') {
    if (
      req.path === '/api/auth/login' ||
      req.path === '/api/auth/refresh' ||
      req.path.startsWith('/api/auctions')
    ) return next();
  }

  const rawIp = getClientIp(req);
  const ip = normalizeIp(rawIp);
  const now = Date.now();

  // ponytail: логирование для диагностики - какие запросы приходят к /api
  // логируем только для /api/auctions, /api/auth.me, /api/csrf-token, чтобы не заспамить консоль
  if (req.path === '/api/auctions' || req.path === '/api/auth/me' || req.path === '/api/csrf-token') {
    console.log(`[RateLimit] Request: ${req.method} ${req.originalUrl} - IP: ${ip}`);
  }

  const currentEntry = memoryLimitStore.get(ip);

  if (currentEntry && currentEntry.resetAt > now) {
    if (currentEntry.count >= MAX_REQUESTS_PER_WINDOW) {
      if (shouldLogRequestCount(currentEntry.count)) {
        console.log(
          `[RateLimit] Request count for ${req.method} ${req.path} - IP: ${ip}, RequestCount: ${currentEntry.count}, Max: ${MAX_REQUESTS_PER_WINDOW}`
        );
      }
      console.log(
        `[RateLimit] Memory block - IP: ${ip}, RequestCount: ${currentEntry.count}, Max: ${MAX_REQUESTS_PER_WINDOW}, Path: ${req.path}, Method: ${req.method}`
      );
      return res.status(429).json({
        error: "Слишком много запросов от этого IP-адреса.",
        message: `Превышен лимит запросов. Попробуйте через ${WINDOW_SIZE_IN_SECONDS} секунд.`,
        retryAfter: WINDOW_SIZE_IN_SECONDS,
        path: req.path,
        method: req.method,
      });
    }
    currentEntry.count++;
  } else {
    memoryLimitStore.set(ip, { count: 1, resetAt: now + WINDOW_SIZE_IN_SECONDS * 1000 });
  }

  next();
}
