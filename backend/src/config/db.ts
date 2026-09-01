import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// ✅ Настройки connection pool для Supabase (pgbouncer — transaction pooling mode)
//
// 🔒 SSL verification для Supabase pgbouncer:
// Для Supabase pgbouncer rejectUnauthorized должен быть false (self-signed cert в пулере).
// Для production PostgreSQL с валидным cert: DATABASE_REJECT_UNAUTHORIZED=true
// По умолчанию false — для совместимости с Supabase.
const rejectUnauthorized = process.env.DATABASE_REJECT_UNAUTHORIZED === "true";

// 🔑 Параметры pool оптимизированы для Supabase pgbouncer:
// - connectionTimeoutMillis: 10000ms — надёжный SSL handshake
// - idleTimeoutMillis: 10000 — МЕНЬШЕ чем pgbouncer idle timeout (~30с)
//   чтобы пул сам закрывал соединения ДО того, как pgbouncer их убьёт
// - max: 10 — соответствует лимитам Supabase free tier
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized },
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  maxUses: Number.POSITIVE_INFINITY,
});

// Отключаем спам-логирование — только ошибки
pool.on("error", (err) => {
  console.error("❌ Unexpected DB pool error:", err.message);
});

const adapter = new PrismaPg(pool);

// Инициализация PrismaClient с driver adapter для PostgreSQL
export const prisma = new PrismaClient({ adapter });

// 🔁 Retry middleware для обработки transient connection errors от pgbouncer
// pgbouncer в transaction pooling mode может разорвать соединение В МОМЕНТ запроса
// Prisma 7 не поддерживает $use — используем утилитарную функцию-обёртку

// Connection errors, которые нужно retry:
const RETRYABLE_ERRORS = [
  "Connection terminated",
  "Connection reset",
  "ECONNRESET",
  "ETIMEDOUT",
  "pool timed out",
  "no connection is available",
];

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return RETRYABLE_ERRORS.some((pattern) => message.includes(pattern.toLowerCase()));
}

/**
 * Обёртка для выполнения Prisma запросов с retry логикой.
 * Автоматически retry при transient connection errors (pgbouncer).
 * @param fn - функция с запросом к базе данных
 * @returns результат запроса
 */
export async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = 100 * 2 ** attempt; // 100ms, 200ms
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Retryable error, attempt ${attempt + 1}/${maxRetries}: ${errorMsg}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else if (isRetryableError(error)) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ All retries exhausted: ${errorMsg}`);
      }
    }
  }

  throw lastError;
}

export { pool };
