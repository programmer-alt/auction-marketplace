import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  enableOfflineQueue: true,
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 200, 5000),
  reconnectOnError: () => true,
  keepAlive: 10000,
  connectTimeout: 10000,
});

redis.on("error", (err: Error) => {
  console.error("Redis client error:", err);
});

redis.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

redis.on("connect", () => {
  console.log("Redis connected");
});

export const safeRedis = {
  async get(key: string): Promise<string | null> {
    try { return await redis.get(key); }
    catch (err) { console.error("Redis get failed:", err); return null; }
  },
  async setex(key: string, ttl: number, value: string): Promise<void> {
    try { await redis.setex(key, ttl, value); }
    catch (err) { console.error("Redis setex failed:", err); }
  },
  async del(...keys: string[]): Promise<void> {
    try { if (keys.length > 0) await redis.del(...keys); }
    catch (err) { console.error("Redis del failed:", err); }
  },
  async keys(pattern: string): Promise<string[]> {
    try { return await redis.keys(pattern); }
    catch (err) { console.error("Redis keys failed:", err); return []; }
  },
};
