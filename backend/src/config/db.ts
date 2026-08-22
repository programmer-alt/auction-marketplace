import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// ✅ Настройки connection pool для Supabase (pgbouncer)
// ВАЖНО: idleTimeoutMillis: 0 — отключаем таймаут, т.к. Supabase pgbouncer
// сам управляет жизненным циклом соединений и может разорвать idle-соединения.
// Если оставить 30000 — будет конфликт: пул ждёт 30с, Supabase закрывает через 10с.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10, // Supabase имеет лимиты — уменьшаем
  idleTimeoutMillis: 0, // 0 = never disconnect idle (пусть pgbouncer решает)
  connectionTimeoutMillis: 5000,
  // maxUses и application_name не работают с pg-pool в connection mode
});

// Отключаем спам-логирование — только ошибки
pool.on("error", (err) => {
  console.error("❌ Unexpected DB pool error:", err.message);
});

const adapter = new PrismaPg(pool);

// Инициализация PrismaClient с driver adapter для PostgreSQL
export const prisma = new PrismaClient({ adapter });

export { pool };
