// Функция получения статистики очереди
import Queue from "bull";
import { prisma } from "../config/db";
import { getIo } from "../config/socket";
import logger from "../config/logger";
import { getBullRedisClients } from "../config/redisBull";
export async function getQueueStats() {
  return await auctionCompletionQueue.getJobCounts();
}

// Graceful shutdown
export async function gracefulShutdown() {
  queueLogger.info("🛑 Остановка очереди завершения аукционов...");
  
  // Закрываем соединения с Redis
  Object.entries(sharedBullClients).forEach(([type, client]) => {
    if (client && typeof client.quit === 'function') {
      client.quit();
      queueLogger.info(`🔒 Закрыто соединение Redis (${type})`);
    }
  });

  // Останавливаем очередь
  await auctionCompletionQueue.close();
  queueLogger.info("✅ Очередь завершения аукционов остановлена");
}


// Глобальный объект для хранения клиентов Redis, чтобы можно было их корректно закрыть при shutdown
export const sharedBullClients: Record<string, any> = {
  client: null,
  subscriber: null,
  bclient: null,
};

// Типизация данных задачи
interface AuctionCompletionJobData {
  auctionId: number;
}

// Константы WebSocket событий
const WS_AUCTION_ENDED = "auction:ended";
const WS_AUCTION_UPDATED = "auction:updated";
const WS_AUCTION_WON = "auction:won";
const WS_AUCTION_SOLD = "auction:sold";

// Логгер с временными метками и уровнями
const queueLogger = {
  info: (msg: string) => logger.info(msg),
  warn: (msg: string) => logger.warn(msg),
  error: (msg: string, err?: unknown) => logger.error(msg, err),
  debug: (msg: string) => logger.debug(msg),
};

const { createClient } = getBullRedisClients();

export const auctionCompletionQueue = new Queue<AuctionCompletionJobData>(
  "auctionCompletion",
  {
    createClient: (type: "client" | "subscriber" | "bclient") => {
      const client = createClient(type);
      sharedBullClients[type] = client;
      if (client) {
        client.on("error", (err: Error & { code?: string }) => {
          if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") return;
          logger.error(`[bull:${type}] Redis error:`, err);
        });
      }
      return client!;
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
    settings: {
      lockDuration: 30000, // 30 seconds
      stalledInterval: 30000, // How often to check for stalled jobs
      maxStalledCount: 1, // Max times a job can be stalled
      guardInterval: 5000, // Delay between [check for guard] events
      retryProcessDelay: 5000, // Delay before retrying a process
      drainDelay: 5, // Delay before emitted drain event
    },
  },
);


// Обработчик задачи
auctionCompletionQueue.process(async (job: any) => {
  const { auctionId } = job.data as AuctionCompletionJobData;

  if (!auctionId || typeof auctionId !== "number") {
    logger.error(`Некорректный auctionId: ${auctionId}`);
    return;
  }

  queueLogger.info(`🔄 Завершение аукциона ${auctionId}`);

  try {
    // Проверяем статус перед обновлением — защита от двойного завершения
    const existing = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { status: true },
    });

    if (!existing) {
      queueLogger.warn(`Аукцион ${auctionId} не найден, пропускаем`);
      return;
    }

    if (existing.status !== "ACTIVE") {
      queueLogger.warn(
        `Аукцион ${auctionId} уже имеет статус ${existing.status}, пропускаем`,
      );
      return;
    }

    let auction = await prisma.auction.update({
      where: { id: auctionId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
      include: {
        winner: { select: { id: true, email: true } },
      },
    });

    // Fallback: если победитель не установлен — берём из последней ставки
    let {winnerId} = auction;
    if (!winnerId) {
      const lastBid = await prisma.bid.findFirst({
        where: { auctionId },
        orderBy: { amount: "desc" },
        select: { userId: true },
      });
      if (lastBid) {
        auction = await prisma.auction.update({
          where: { id: auctionId },
          data: { winnerId: lastBid.userId },
          include: { winner: { select: { id: true, email: true } } },
        });
        winnerId = lastBid.userId;
        queueLogger.info(
          `🏆 Победитель аукциона ${auctionId} определён из ставок: ${winnerId}`,
        );
      }
    }

    const payload = {
      auctionId: auction.id,
      status: auction.status,
      winner: auction.winner,
      finalPrice: auction.currentPrice,
      endedAt: auction.endsAt,
    };

    const io = getIo();
    io.to(`auction:${auctionId}`).emit(WS_AUCTION_ENDED, payload);
    io.emit(WS_AUCTION_UPDATED, payload);

    if (winnerId) {
      io.to(`user:${winnerId}`).emit(WS_AUCTION_WON, {
        auctionId: auction.id,
        title: auction.title,
        amount: auction.currentPrice,
      });
    }

    io.to(`user:${auction.sellerId}`).emit(WS_AUCTION_SOLD, {
      auctionId: auction.id,
      title: auction.title,
      winnerId,
      amount: auction.currentPrice,
    });

    queueLogger.info(
      `✅ Аукцион ${auctionId} завершён, победитель: ${winnerId ?? "нет"}, цена: ${auction.currentPrice}`,
    );
  } catch (error) {
    queueLogger.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
    throw error instanceof Error
      ? error
      : new Error(`Unknown error completing auction ${auctionId}`);
  }
});

// Функция добавления задачи на завершение аукциона
export function scheduleAuctionCompletion(auctionId: number, endsAt: Date) {
  const delay = endsAt.getTime() - Date.now();
  if (delay <= 0) {
    queueLogger.warn(`⏰ Аукцион ${auctionId} уже должен был завершиться`);
    return auctionCompletionQueue.add(
      { auctionId },
      { delay: 1000 } // Запускаем через 1 секунду, если уже просрочен
    );
  }

  return auctionCompletionQueue.add(
    { auctionId },
    { delay }
  );
}

// Функция отмены запланированной задачи
export async function cancelAuctionCompletion(auctionId: number) {
  // Находим задачи, связанные с этим аукционом
  const jobs = await auctionCompletionQueue.getDelayed();
  const jobToCancel = jobs.find(job => job.data.auctionId === auctionId);

  if (jobToCancel) {
    await jobToCancel.remove();
    queueLogger.info(`❌ Задача завершения аукциона ${auctionId} отменена`);
    return true;
  }

  return false;
}

// Альтернативное название функции для обратной совместимости
export const removeScheduledAuctionCompletion = cancelAuctionCompletion;

// Функция планирования завершения существующих аукционов при запуске приложения
export async function scheduleExistingAuctions() {
  // Находим все активные аукционы, которые должны завершиться в будущем
  const now = new Date();
  const auctions = await prisma.auction.findMany({
    where: {
      status: 'ACTIVE',
      endsAt: {
        gt: now,
      },
    },
    select: {
      id: true,
      endsAt: true,
    },
  });

  queueLogger.info(`⏳ Найдено ${auctions.length} активных аукционов для планирования`);

  for (const auction of auctions) {
    const delay = auction.endsAt.getTime() - now.getTime();
    if (delay > 0) {
      // Проверяем, есть ли уже запланированная задача для этого аукциона
      const existingJobs = await auctionCompletionQueue.getDelayed();
      const existingJob = existingJobs.find(job => job.data.auctionId === auction.id);

      if (!existingJob) {
        await auctionCompletionQueue.add(
          { auctionId: auction.id },
          { delay }
        );
        queueLogger.info(`⏰ Планирование завершения аукциона ${auction.id} через ${Math.round(delay / 1000)} сек.`);
      } else {
        queueLogger.info(`📋 Аукцион ${auction.id} уже запланирован для завершения`);
      }
    }
  }
}