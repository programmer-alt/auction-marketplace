import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Настройка пула подключений
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Создание адаптера
const adapter = new PrismaPg(pool);

// Инициализация PrismaClient с адаптером
export const prisma = new PrismaClient({ 
  adapter,
  log: ['query', 'info', 'warn', 'error'], // Добавляем логирование для отладки
});

export { pool };