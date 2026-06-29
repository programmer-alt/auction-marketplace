import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

async function testAdapterConnection() {
  console.log('Тестирование подключения с адаптером...');

  // Создаем обычное подключение к PostgreSQL для проверки
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✓ Подключение к PostgreSQL установлено напрямую');
    await client.end();
  } catch (error) {
    console.error('✗ Ошибка подключения к PostgreSQL напрямую:', error);
    return;
  }

  // Настройка пула подключений
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Проверяем пул подключений
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Подключение через пул установлено');
  } catch (error) {
    console.error('✗ Ошибка подключения через пул:', error);
    pool.end();
    return;
  }

  // Создание адаптера
  const adapter = new PrismaPg(pool);

  try {
    // Инициализация PrismaClient с адаптером
    const prisma = new PrismaClient({ adapter });

    // Пробуем выполнить простой запрос
    await prisma.$connect();
    console.log('✓ PrismaClient подключен с адаптером');

    // Закрываем соединение
    await prisma.$disconnect();
    console.log('✓ Соединение закрыто');
  } catch (error) {
    console.error('✗ Ошибка подключения PrismaClient с адаптером:', error);
  } finally {
    // Закрываем пул подключений
    await pool.end();
  }
}

testAdapterConnection().catch(console.error);