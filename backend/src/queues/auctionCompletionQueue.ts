import Queue from "bull";
import { prisma } from "../config/db";
import { getIo } from "../config/socket";
import logger from "../config/logger";
import { getBullRedisClients } from "../config/redisBull";

// Глобальный объект для хранения клиентов Redis, чтобы можно было их корректно закрыть при shutdown
export const sharedBullClients = {
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

export const auctionCompletionQueue = new Queue(
  "auctionCompletion",
  {
    createClient: (type: "client" | "subscriber" | "bclient") => {
      const client = createClient(type);
      sharedBullClients[type] = client;
      client.on("error", (err: Error & { code?: string }) => {
        if (err.code === "ECONNRESET" || err.code === "ECONNREFUSED") return;
        logger.error(`[bull:${type}] Redis error:`, err);
      });
      return client;
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
    settings: {
      lockDuration: 60000, // 60 seconds
      maxStalledCount: 3,
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

/**
 * Добавляет задачу на завершение аукциона
 */
export async function scheduleAuctionCompletion(
  auctionId: number,
  endsAt: Date,
): Promise<void> {
  const delay = endsAt.getTime() - Date.now();
  const jobId = `auction:${auctionId}`;

  // Защита от дубликатов
  const existing = await auctionCompletionQueue.getJob(jobId);
  if (existing) {
    queueLogger.warn(`Задача для аукциона ${auctionId} уже существует, пропускаем`);
    return;
  }

  await (auctionCompletionQueue as any).add(
    { auctionId },
    { delay: Math.max(delay, 0), jobId },
  );
  queueLogger.info(
    delay <= 0
      ? `Аукцион ${auctionId} просрочен, добавляем немедленно`
      : `⏰ Запланировано завершение аукциона ${auctionId} через ${Math.round(delay / 1000)} сек`,
  );
}

/**
 * Удаляет запланированную задачу завершения аукциона
 */
export async function removeScheduledAuctionCompletion(
  auctionId: number,
): Promise<boolean> {
  const job = await auctionCompletionQueue.getJob(`auction:${auctionId}`);
  if (job) {
    await job.remove();
    queueLogger.info(`🗑️ Удалена задача для аукциона ${auctionId}`);
    return true;
  }
  return false;
}

/**
 * Планирует завершение для всех активных аукционов при запуске сервера
 */
export async function scheduleExistingAuctions(batchSize = 100): Promise<void> {
  queueLogger.info("🔍 Поиск активных аукционов...");

  let skip = 0;
  let total = 0;

  while (true) {
    const auctions = await prisma.auction.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, endsAt: true },
      take: batchSize,
      skip,
      orderBy: { endsAt: "asc" },
    });

    if (auctions.length === 0) break;

    const now = new Date();
    const overdue = auctions.filter((a: { id: number; endsAt: Date }) => a.endsAt <= now).length;
    const upcoming = auctions.filter((a: { id: number; endsAt: Date }) => a.endsAt > now).length;
    queueLogger.debug(
      `Пачка: ${auctions.length} аукционов (просрочено: ${overdue}, предстоит: ${upcoming})`,
    );

    for (const auction of auctions) {
      await scheduleAuctionCompletion(auction.id, auction.endsAt);
    }

    total += auctions.length;
    skip += batchSize;

    if (auctions.length < batchSize) break;
  }

  queueLogger.info(`📋 Запланировано ${total} аукционов`);
}
