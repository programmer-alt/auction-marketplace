import Redis from "ioredis";

function getRedisUrlOrNull(): string | null {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === "") return null;
  return url;
}

export function getBullRedisClients() {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    // Redis отсутствует — очередь/соединения отключаем на уровне инициализации.
    return { createClient: () => null } as const;
  }

  const isRediss = redisUrl.startsWith("rediss://");

  const baseOptions = {
    url: redisUrl,
    lazyConnect: true,
    // Для cloud Redis при rediss:// включаем TLS.
    // rejectUnauthorized=false сохранён как в текущей реализации, чтобы не ломать подключение.
    tls: isRediss ? ({ rejectUnauthorized: false } as any) : undefined,
  };

  const createClient = (type: "client" | "subscriber" | "bclient") => {
    // Только для `client` (воркер) — жёсткие настройки
    if (type === "client") {
      return new Redis({
        ...baseOptions,
        enableReadyCheck: false,
        maxRetriesPerRequest: undefined,
        connectionName: `bull-${type}`,
      });
    }

    // Для bclient и subscriber — просто используем baseOptions
    return new Redis({
      ...baseOptions,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      connectionName: `bull-${type}`,
    });
  };

  return { createClient };
}