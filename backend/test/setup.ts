import { vi } from "vitest";
import { beforeEach, afterEach } from "vitest";

// ==============================
// Моки Redis для тестов
// ==============================
const redisStore = new Map<string, string>();
const redisCounters = new Map<string, number>();

vi.mock("../src/config/redis", () => {
  return {
    safeRedis: {
      async get(key: string) {
        return redisStore.has(key) ? redisStore.get(key)! : null;
      },
      async set(key: string, value: string) {
        redisStore.set(key, value);
      },
      async setex(key: string, _ttl: number, value: string) {
        // TTL игнорируем в unit-тестах
        redisStore.set(key, value);
      },
      async incr(key: string) {
        const next = (redisCounters.get(key) ?? 0) + 1;
        redisCounters.set(key, next);
        return next;
      },
      async del(...keys: string[]) {
        for (const k of keys) {
          redisStore.delete(k);
          redisCounters.delete(k);
        }
      },
      async keys(pattern: string) {
        // Минимально поддерживаем '*' по префиксу для наших тестов
        const prefix = pattern.replace("*", "");
        return Array.from(redisStore.keys()).filter((k) => k.startsWith(prefix));
      },
    },
  };
});

// Очистка после каждого теста
afterEach(() => {
  vi.clearAllMocks();
  vi.resetAllMocks();
  redisStore.clear();
  redisCounters.clear();
});

// Глобальная настройка
beforeEach(() => {
  process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? "test-csrf-secret";
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";

  vi.mock("../src/index.ts", () => ({
    prisma: {
      auction: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      bid: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
    io: {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    },
  }));
});

