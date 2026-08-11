import Redis from 'ioredis';
import logger from './logger';
import fs from 'fs';
import path from 'path';

// Проверяем наличие конфигурации Redis
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
const redisPassword = process.env.REDIS_PASSWORD;
const redisUsername = process.env.REDIS_USERNAME || 'default';

function getRedisUrl(): string | null {
  // Сначала проверяем, задан ли REDIS_URL напрямую
  const url = process.env.REDIS_URL;
  if (url && url.trim() !== "") {
    return url;
  }

  // Если REDIS_URL не задан, собираем из компонентов
  if (!redisHost || !redisPort || !redisPassword) {
    return null;
  }

  // Формируем URL для ioredis: redis://:password@host:port
  // Для Redis Cloud с TLS используем rediss://
    // Проверяем REDIS_SECURE с приоритетом (если задан, используем его значение)
  const redisSecureEnv = process.env.REDIS_SECURE;
  const isSecure = redisSecureEnv !== undefined && redisSecureEnv !== ""
    ? redisSecureEnv === "true"
    : (redisHost.includes("redislabs") || redisPort.toString() === "6380");
  const protocol = isSecure ? "rediss" : "redis";
  
  return `${protocol}://${redisUsername}:${redisPassword}@${redisHost}:${redisPort}`;
}

// В dev/CI иногда Redis может быть недоступен. Не падаем при импорте модуля,
// а отдаём no-op safeRedis, чтобы остальная часть приложения поднималась.
const redisUrl = getRedisUrl();

// Проверяем, является ли URL защищенным (rediss://)
const isSecureConnection = redisUrl?.startsWith("rediss://") || false;

// Безопасное конфигурирование TLS: загружаем CA из REDIS_CA_PATH если задан
function getTlsConfig(): Record<string, unknown> | undefined {
  if (!isSecureConnection) return undefined;

  const caPath = process.env.REDIS_CA_PATH;
  let ca: Buffer | string | undefined;

  if (caPath) {
    // Protect against path traversal: use only the basename,
    // resolve relative to the project root (backend/ directory).
    const baseName = path.basename(caPath);
    const resolvedPath = path.resolve(process.cwd(), 'certs', baseName);
    
    try {
      fs.accessSync(resolvedPath, fs.constants.R_OK);
      ca = fs.readFileSync(resolvedPath);
    } catch (err) {
      logger.warn(`REDIS_CA_PATH "${resolvedPath}" недоступен для чтения, используем системные CA:`, err);
    }
  }

  // В продакшене валидация обязательна; в dev можно отключить только с явным флагом
  const rejectUnauthorized =
    process.env.REDIS_DISABLE_TLS_VERIFY !== 'true' &&
    process.env.NODE_ENV !== 'development';

  return {
    ca,
    rejectUnauthorized,
  };
}

export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: false, // Подключаться сразу, а не лениво
      // Убираем параметры, несовместимые с Bull
      maxRetriesPerRequest: null, // Отключаем встроенную систему повторных попыток Bull (null означает отсутствие лимита)
      enableReadyCheck: false, // Отключаем проверку готовности, чтобы избежать конфликта с Bull
      connectionName: 'main-app',
      tls: getTlsConfig(),
    })
  : null;

// Обработка ошибок подключения
if (redis) {
  redis.on('error', (err: Error & { code?: string }) => {
    if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'ENOENT') {
      // Пропускаем стандартные ошибки подключения
      return;
    }
    logger.error('Redis client error:', err);
  });

  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('close', () => {
    logger.warn('Redis client closed');
  });
}

// Функция для безопасного подключения
async function ensureConnected() {
  if (!redis) return;
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  try {
    await redis.connect();
  } catch (err) {
    logger.error('Redis connect failed:', err);
  }
}

// Safe Redis interface для обратной совместимости
export const safeRedis = {
  async get(key: string): Promise<string | null> {
    if (!redis) return null;
    try {
      await ensureConnected();
      return await redis.get(key);
    } catch (err) {
      logger.error('Redis get failed:', err);
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (!redis) return;
    try {
      await ensureConnected();
      await redis.set(key, value);
    } catch (err) {
      logger.error('Redis set failed:', err);
    }
  },

  async setex(key: string, ttl: number, value: string): Promise<void> {
    if (!redis) return;
    try {
      await ensureConnected();
      await redis.setex(key, ttl, value);
    } catch (err) {
      logger.error('Redis setex failed:', err);
    }
  },

  async ttl(key: string): Promise<number | null> {
    if (!redis) return null;
    try {
      await ensureConnected();
      const t = await redis.ttl(key);
      if (t < 0) return null;
      return t;
    } catch (err) {
      logger.error('Redis ttl failed:', err);
      return null;
    }
  },

  async incr(key: string): Promise<number | null> {
    if (!redis) return null;
    try {
      await ensureConnected();
      return await redis.incr(key);
    } catch (err) {
      logger.error('Redis incr failed:', err);
      return null;
    }
  },

  async del(...keys: string[]): Promise<void> {
    if (!redis || keys.length === 0) return;
    try {
      await ensureConnected();
      await redis.del(...keys);
    } catch (err) {
      logger.error('Redis del failed:', err);
    }
  },

  // Безопасная замена redis.keys(): используем SCAN (не блокирует Redis).
  async keys(pattern: string, limit = 1000): Promise<string[]> {
    if (!redis) return [];
    try {
      await ensureConnected();
      const found: string[] = [];

      // Используем scanIterator для SCAN (не блокирует Redis)
      for await (const key of redis.scanStream({ match: pattern, count: 200 })) {
        found.push(key);
        if (found.length >= limit) break;
      }

      return found;
    } catch (err) {
      logger.error('Redis scan(keys) failed:', err);
      return [];
    }
  }
};

// Экспортируем функцию для закрытия соединения (если требуется)
export async function closeRedis() {
  if (redis) {
    try {
      await redis.quit();
    } catch (err) {
      logger.error('Redis close failed:', err);
    }
  }
}
