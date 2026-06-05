import Redis, { type RedisOptions } from "ioredis";
import logger from "./logger";

function getRedisUrlOrNull(): string | null {
  // Сначала проверяем, задан ли REDIS_URL напрямую
  const url = process.env.REDIS_URL;
  if (url && url.trim() !== "") {
    return url;
  }

  // Если REDIS_URL не задан, собираем из компонентов
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;
  const redisPassword = process.env.REDIS_PASSWORD;
  const redisUsername = process.env.REDIS_USERNAME || 'default';

  if (!redisHost || !redisPort || !redisPassword) {
    return null;
  }

  // Формируем URL для ioredis: redis://:password@host:port
  // Для Redis Cloud с TLS используем rediss://
    // Проверяем REDIS_SECURE с приоритетом (если задан, используем его значение)
  const redisSecureEnv = process.env.REDIS_SECURE;
  const isSecure = redisSecureEnv !== undefined && redisSecureEnv !== ""
    ? redisSecureEnv === "true"
    : (redisHost.includes("redislabs") || redisPort === "6380");
  const protocol = isSecure ? "rediss" : "redis";
  
  return `${protocol}://${redisUsername}:${redisPassword}@${redisHost}:${redisPort}`;
}

export function getBullRedisClients() {
  const redisUrl = getRedisUrlOrNull();
  if (!redisUrl) {
    // Redis отсутствует — очередь/соединения отключаем на уровне инициализации.
    return { createClient: () => null } as const;
  }

  const isRediss = redisUrl.startsWith("rediss://");

  // Для Redis Cloud с TLS используем правильные настройки
  const baseOptions: RedisOptions = {
    lazyConnect: false, // Подключаться сразу, а не лениво
    // Отключаем параметры, несовместимые с Bull
    maxRetriesPerRequest: null, // Отключаем встроенную систему повторных попыток (null означает отсутствие лимита)
    enableReadyCheck: false, // Отключаем проверку готовности
    connectionName: 'bull-shared',
  };

  // Если используется TLS, добавляем параметры TLS
  if (isRediss) {
    baseOptions.tls = {
      rejectUnauthorized: false, // Отключаем проверку сертификатов для облачных провайдеров Redis
    };
  }

  const createClient = (type: "client" | "subscriber" | "bclient") => {
    // Создаем клиента, используя правильную сигнатуру конструктора ioredis
    // new Redis(path: string, options?: RedisOptions)
    const client = new Redis(redisUrl, {
      ...baseOptions,
      connectionName: `bull-${type}`,
    });

    // Обработчики событий подключения
    client.on('connect', () => {
      logger.info(`Redis ${type} client connected`);
    });

    client.on('error', (err: Error & { code?: string }) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
      logger.error(`Redis ${type} client error:`, err);
    });

    client.on('close', () => {
      logger.warn(`Redis ${type} client closed`);
    });

    return client;
  };

  return { createClient };
}
