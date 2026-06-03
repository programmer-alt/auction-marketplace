import { createClient } from 'redis';
import logger from './logger';

// Проверяем наличие конфигурации Redis
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
const redisPassword = process.env.REDIS_PASSWORD;
const redisUsername = process.env.REDIS_USERNAME || 'default';

// В dev/CI иногда Redis может быть недоступен. Не падаем при импорте модуля,
// а отдаём no-op safeRedis, чтобы остальная часть приложения поднималась.
if (!redisHost || !redisPort || !redisPassword) {
  console.warn('[redis] Redis configuration is incomplete. Redis features will be disabled.');
}

// Создаём клиент Redis с объектной конфигурацией
export const redis = redisHost && redisPort && redisPassword
  ? createClient({
      username: redisUsername,
      password: redisPassword,
      socket: {
        host: redisHost,
        port: redisPort
      }
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
}

// Функция для безопасного подключения
async function ensureConnected() {
  if (!redis) return;
  if (redis.isOpen) return;
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
      const result = await redis.get(key);
      return result;
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
      await redis.set(key, value, { EX: ttl });
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
      const result = await redis.incr(key);
      return result;
    } catch (err) {
      logger.error('Redis incr failed:', err);
      return null;
    }
  },

  async del(...keys: string[]): Promise<void> {
    if (!redis || keys.length === 0) return;
    try {
      await ensureConnected();
      await redis.del(keys);
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
      for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
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
