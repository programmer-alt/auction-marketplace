import Queue from "bull";
import Redis from "ioredis";
import { prisma } from "../config/db";
import { getIo } from "../config/socket";


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
const logger = {
  info: (msg: string) =>
    console.log(`[${new Date().toISOString()}] INFO:  ${msg}`),
  warn: (msg: string) =>
    console.warn(`[${new Date().toISOString()}] WARN:  ${msg}`),
  error: (msg: string, err?: unknown) =>
    console.error(`[${new Date().toISOString()}] ERROR: ${msg}`, err ?? ""),
  debug: (msg: string) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[${new Date().toISOString()}] DEBUG: ${msg}`);
    }
  },
};

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Создаём три клиента один раз и переиспользуем их
export const sharedBullClients = {
  client: null as Redis | null,
  subscriber: null as Redis | null,
  bclient: null as Redis | null,
};

const createBullClient = (type: "client" | "subscriber" | "bclient") => {
  if (sharedBullClients[type]) return sharedBullClients[type]!;

  const client = new Redis(redisUrl, {
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    keepAlive: 10000,
    retryStrategy: type === "bclient"
      ? undefined
      : (times) => Math.min(times * 50, 2000),
  });

  client.on("error", (err: Error & { code?: string }) => {
    if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') return;
    console.error(`[bull:${type}] Redis error:`, err);
  });

  sharedBullClients[type] = client;
  return client;
};

export const auctionCompletionQueue = new Queue<AuctionCompletionJobData>(
  "auctionCompletion",
  {
    createClient: createBullClient,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
);

// Обработчик задачи
auctionCompletionQueue.process(async (job) => {
  const { auctionId } = job.data;

  if (!auctionId || typeof auctionId !== "number") {
    logger.error(`Некорректный auctionId: ${auctionId}`);
    return;
  }

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

    if (existing.status !== "ACTIVE") {
      logger.warn(
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
        logger.info(
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

    logger.info(
      `✅ Аукцион ${auctionId} завершён, победитель: ${winnerId ?? "нет"}, цена: ${auction.currentPrice}`,
    );
  } catch (error) {
    logger.error(`❌ Ошибка завершения аукциона ${auctionId}:`, error);
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
    logger.warn(`Задача для аукциона ${auctionId} уже существует, пропускаем`);
    return;
  }

  await auctionCompletionQueue.add(
    { auctionId },
    { delay: Math.max(delay, 0), jobId },
  );
  logger.info(
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
    logger.info(`🗑️ Удалена задача для аукциона ${auctionId}`);
    return true;
  }
  return false;
}

/**
 * Планирует завершение для всех активных аукционов при запуске сервера
 */
export async function scheduleExistingAuctions(batchSize = 100): Promise<void> {
  logger.info("🔍 Поиск активных аукционов...");

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
    logger.debug(
      `Пачка: ${auctions.length} аукционов (просрочено: ${overdue}, предстоит: ${upcoming})`,
    );

    for (const auction of auctions) {
      await scheduleAuctionCompletion(auction.id, auction.endsAt);
    }

    total += auctions.length;
    skip += batchSize;

    if (auctions.length < batchSize) break;
  }

  logger.info(`📋 Запланировано ${total} аукционов`);
}
