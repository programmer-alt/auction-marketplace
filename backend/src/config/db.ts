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
  log: [
    { level: 'info', emit: 'event' },
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
    ...(process.env.NODE_ENV === 'development' 
      ? [{ level: 'query', emit: 'event' }] 
      : [])
  ]
});

// В development среде продолжаем логировать запросы для отладки
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    console.log(`prisma:query ${e.query}`);
  });
}

export { pool };