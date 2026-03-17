import Queue from 'bull';
import { prisma } from '../index';
import { io } from '../index';

export const auctionCompletionQueue = new Queue('auctionCompletion', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Обработчик задачи
auctionCompletionQueue.process(async (job) => {
  const { auctionId } = job.data;
  console.log(`🔄 Завершение аукциона ${auctionId}`);

  try {
    const auction = await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'COMPLETED' },
      include: {
        seller: true,
        winner: true,
      },
    });

    // Отправляем WebSocket уведомление
    io.to(`auction:${auctionId}`).emit('auction:ended', auction);
    io.emit('auction:updated', auction);

    console.log(`✅ Аукцион ${auctionId} завершён`);
  } catch (error) {
    console.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
    throw error;
  }
});

// Функция добавления задачи на завершение аукциона
export function scheduleAuctionCompletion(auctionId: number, endsAt: Date) {
  const delay = endsAt.getTime() - Date.now();
  if (delay <= 0) {
    // Если время уже прошло, завершаем немедленно
    auctionCompletionQueue.add({ auctionId }, { delay: 0 });
    return;
  }
  auctionCompletionQueue.add({ auctionId }, { delay });
  console.log(`⏰ Запланировано завершение аукциона ${auctionId} через ${delay}ms`);
}

// Функция удаления запланированной задачи (при обновлении даты окончания)
export async function removeScheduledAuctionCompletion(auctionId: number) {
  const jobs = await auctionCompletionQueue.getJobs(['delayed', 'waiting']);
  for (const job of jobs) {
    if (job.data.auctionId === auctionId) {
      await job.remove();
      console.log(`🗑️ Удалена запланированная задача для аукциона ${auctionId}`);
    }
  }
}

// Планирование завершения для всех активных аукционов при запуске сервера
export async function scheduleExistingAuctions() {
  console.log('🔍 Поиск активных аукционов для планирования завершения...');
  const activeAuctions = await prisma.auction.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: { gt: new Date() },
    },
  });

  console.log(`📋 Найдено ${activeAuctions.length} активных аукционов`);
  for (const auction of activeAuctions) {
    scheduleAuctionCompletion(auction.id, auction.endsAt);
  }
}