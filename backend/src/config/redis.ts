import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "./logger";

dotenv.config();

// Используем URL для подключения к облачному Redis
const redisUrl = process.env.REDIS_URL || "redis://default:TyKKB11prVd27kLFbuL87ZCpVxDvGUmr@redis-12271.crce198.eu-central-1-3.ec2.cloud.redislabs.com:12271";

export const redis = new Redis(redisUrl, {
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,
  keepAlive: 10000,
  connectTimeout: 10000,
});

redis.on("error", (err: Error & { code?: string }) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
  logger.error("Redis client error:", err);
});

redis.on("reconnecting", () => {
  // Подавляем сообщение о переподключении
  // console.log("Redis reconnecting...");
});

export const safeRedis = {
  async get(key: string): Promise<string | null> {
    try { return await redis.get(key); }
    catch (err) { logger.error("Redis get failed:", err); return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try { await redis.set(key, value); }
    catch (err) { logger.error("Redis set failed:", err); }
  },
  async setex(key: string, ttl: number, value: string): Promise<void> {
    try { await redis.setex(key, ttl, value); }
    catch (err) { logger.error("Redis setex failed:", err); }
  },
  async incr(key: string): Promise<number | null> {
    try { return await redis.incr(key); }
    catch (err) { logger.error("Redis incr failed:", err); return null; }
    },
  async del(...keys: string[]): Promise<void> {
    try { if (keys.length > 0) await redis.del(...keys); }
    catch (err) { logger.error("Redis del failed:", err); }
  },
  async keys(pattern: string): Promise<string[]> {
    try { return await redis.keys(pattern); }
    catch (err) { logger.error("Redis keys failed:", err); return []; }
  },
};