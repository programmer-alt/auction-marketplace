import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Проверяем, что все зависимости импортируются корректно
console.log('Проверка импорта зависимостей...');

// Настройка пула подключений
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || '',
});

// Создание адаптера
const adapter = new PrismaPg(pool);

// Инициализация PrismaClient с адаптером
const prisma = new PrismaClient({
  adapter: adapter,
});

console.log('Конфигурация Prisma создана успешно!');
console.log('PrismaClient инициализирован с адаптером.');

// Экспортируем для возможного использования в других тестах
export { prisma, adapter, pool };