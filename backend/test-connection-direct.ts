import { PrismaClient } from '@prisma/client';

// Прямое подключение без адаптера для проверки
const prisma = new PrismaClient();

async function testDirectConnection() {
  try {
    console.log('Попытка прямого подключения к базе данных...');
    
    // Простой запрос для проверки подключения
    const userCount = await prisma.user.count();
    console.log(`Подключение успешно! Количество пользователей в базе: ${userCount}`);
    
  } catch (error) {
    console.error('Ошибка при прямом подключении к базе данных:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Соединение закрыто');
  }
}

testDirectConnection();