import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Настройка пула подключений
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// Создание адаптера
const adapter = new PrismaPg(pool);

// Инициализация PrismaClient с адаптером
const prisma = new PrismaClient({
  adapter: adapter,
});

async function testConnection() {
  try {
    console.log('Попытка подключения к базе данных...');
    
    // Простой запрос для проверки подключения
    const userCount = await prisma.user.count();
    console.log(`Подключение успешно! Количество пользователей в базе: ${userCount}`);
    
    // Проверим также другие модели
    const auctionCount = await prisma.auction.count();
    const bidCount = await prisma.bid.count();
    const paymentCount = await prisma.payment.count();
    
    console.log(`Количество аукционов: ${auctionCount}`);
    console.log(`Количество ставок: ${bidCount}`);
    console.log(`Количество платежей: ${paymentCount}`);
    
  } catch (error) {
    console.error('Ошибка при подключении к базе данных:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Соединение закрыто');
  }
}

testConnection();