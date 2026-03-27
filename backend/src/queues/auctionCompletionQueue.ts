import Queue from 'bull';
import { prisma } from '../config/db';
import { getIo } from '../config/socket';

export const auctionCompletionQueue = new Queue('auctionCompletion', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
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
    getIo().to(`auction:${auctionId}`).emit('auction:ended', auction);
    getIo().emit('auction:updated', auction);

    console.log(`✅ Аукцион ${auctionId} завершён`);
  } catch (error) {
    console.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
    throw error;
  }
});

// Функция добавления задачи на завершение аукциона
export function scheduleAuctionCompletion(auctionId: number, endsAt: Date) {
  const delay = endsAt.getTime() - Date.now();
  const jobId = `auction:${auctionId}`;
  if (delay <= 0) {
    auctionCompletionQueue.add({ auctionId }, { delay: 0, jobId });
    return;
  }
  auctionCompletionQueue.add({ auctionId }, { delay, jobId });
  console.log(`⏰ Запланировано завершение аукциона ${auctionId} через ${delay}ms`);
}

// Функция удаления запланированной задачи (при обновлении даты окончания)
export async function removeScheduledAuctionCompletion(auctionId: number) {
  const job = await auctionCompletionQueue.getJob(`auction:${auctionId}`);
  if (job) {
    await job.remove();
    console.log(`🗑️ Удалена запланированная задача для аукциона ${auctionId}`);
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