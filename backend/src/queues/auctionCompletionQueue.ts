import Queue from 'bull';
import { prisma } from '../config/db';
import { getIo } from '../config/socket';
import { AuctionStatus } from '@prisma/client';

// Типизация данных задачи
interface AuctionCompletionJobData {
  auctionId: number;
}

// Константы WebSocket событий
const WS_AUCTION_ENDED   = 'auction:ended';
const WS_AUCTION_UPDATED = 'auction:updated';
const WS_AUCTION_WON     = 'auction:won';
const WS_AUCTION_SOLD    = 'auction:sold';

// Логгер с временными метками и уровнями
const logger = {
  info:  (msg: string) => console.log(`[${new Date().toISOString()}] INFO:  ${msg}`),
  warn:  (msg: string) => console.warn(`[${new Date().toISOString()}] WARN:  ${msg}`),
  error: (msg: string, err?: unknown) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, err ?? ''),
  debug: (msg: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${new Date().toISOString()}] DEBUG: ${msg}`);
    }
  },
};

export const auctionCompletionQueue = new Queue<AuctionCompletionJobData>('auctionCompletion', {
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
  logger.info(`🔄 Завершение аукциона ${auctionId}`);

  try {
    // Проверяем статус перед обновлением — защита от двойного завершения
    const existing = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true },
    });

    if (!existing) {
      logger.warn(`Аукцион ${auctionId} не найден, пропускаем`);
      return;
    }

    if (existing.status !== 'ACTIVE') {
      logger.warn(`Аукцион ${auctionId} уже имеет статус ${existing.status}, пропускаем`);
      return;
    }

    const auction = await prisma.auction.update({
      where: { id: auctionId, status: 'ACTIVE' as AuctionStatus },
      data: { status: 'COMPLETED' as AuctionStatus },
      include: {
        seller: true,
        winner: true,
      },
    });

    const io = getIo();

    io.to(`auction:${auctionId}`).emit(WS_AUCTION_ENDED, auction);
    io.emit(WS_AUCTION_UPDATED, auction);

    if (auction.winnerId) {
      io.to(`user:${auction.winnerId}`).emit(WS_AUCTION_WON, {
        auctionId: auction.id,
        title: auction.title,
        amount: auction.currentPrice,
      });
    }

    io.to(`user:${auction.sellerId}`).emit(WS_AUCTION_SOLD, {
      auctionId: auction.id,
      title: auction.title,
      winnerId: auction.winnerId,
      amount: auction.currentPrice,
    });

    logger.info(`✅ Аукцион ${auctionId} завершён`);
  } catch (error) {
    logger.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
    throw error instanceof Error ? error : new Error(`Unknown error completing auction ${auctionId}`);
  }
});

/**
 * Добавляет задачу на завершение аукциона
 */
export function scheduleAuctionCompletion(auctionId: number, endsAt: Date): void {
  const delay = endsAt.getTime() - Date.now();
  const jobId = `auction:${auctionId}`;

  if (delay <= 0) {
    auctionCompletionQueue.add({ auctionId }, { delay: 0, jobId });
    logger.info(`Аукцион ${auctionId} просрочен, добавляем немедленно`);
    return;
  }

  auctionCompletionQueue.add({ auctionId }, { delay, jobId });
  logger.info(`⏰ Запланировано завершение аукциона ${auctionId} через ${Math.round(delay / 1000)} сек`);
}

/**
 * Удаляет запланированную задачу завершения аукциона
 */
export async function removeScheduledAuctionCompletion(auctionId: number): Promise<void> {
  const job = await auctionCompletionQueue.getJob(`auction:${auctionId}`);
  if (job) {
    await job.remove();
    logger.info(`🗑️ Удалена задача для аукциона ${auctionId}`);
  }
}

/**
 * Планирует завершение для всех активных аукционов при запуске сервера
 */
export async function scheduleExistingAuctions(batchSize = 100): Promise<void> {
  logger.info('🔍 Поиск активных аукционов...');

  let skip = 0;
  let total = 0;

  while (true) {
    const auctions = await prisma.auction.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, endsAt: true },
      take: batchSize,
      skip,
      orderBy: { endsAt: 'asc' },
    });

    if (auctions.length === 0) break;

    const now = new Date();
    const overdue  = auctions.filter(a => a.endsAt <= now).length;
    const upcoming = auctions.filter(a => a.endsAt > now).length;
    logger.debug(`Пачка: ${auctions.length} аукционов (просрочено: ${overdue}, предстоит: ${upcoming})`);

    for (const auction of auctions) {
      scheduleAuctionCompletion(auction.id, auction.endsAt);
    }

    total += auctions.length;
    skip  += batchSize;

    if (auctions.length < batchSize) break;
  }

  logger.info(`📋 Запланировано ${total} аукционов`);
}
