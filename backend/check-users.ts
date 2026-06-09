import { prisma } from './src/config/db.ts';

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            auctions: true,
            bids: true,
            payments: true,
          },
        },
      },
    });

    console.log('Пользователи в базе данных:');
    console.log(JSON.stringify(users, null, 2));

    if (users.length === 0) {
      console.log('\nВ базе данных нет пользователей!');
    } else {
      console.log(`\nВсего найдено ${users.length} пользователей.`);
    }
  } catch (error) {
    console.error('Ошибка при проверке пользователей:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
