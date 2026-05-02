import { prisma } from "../config/db";
import { getIo } from "../config/socket";
import {
  getAuctions as getAuctionsRepo,
  getAuctionsCount,
  getAuctionById as getAuctionByIdRepo,
  createAuction as createAuctionRepo,
  updateAuctionById as updateAuctionByIdRepo,
} from "../repositories/auctions.repository";
import {
  scheduleAuctionCompletion,
  removeScheduledAuctionCompletion,
} from "../queues/auctionCompletionQueue";
import { safeRedis } from "../config/redis";
import {
  safeJsonParse,
  validateAuction,
  validateAuctionsList,
} from "../utils/json";
import { sanitizeObject } from "../utils/sanitization";
import { Prisma } from "../types";

type Auction = Prisma.AuctionGetPayload<{}>;
import {
  createValidationError,
  createForbiddenError,
  createNotFoundError,
} from "../errors/factories";

// ========================================
// Константы кэширования
// ========================================
const CACHE_TTL_SECONDS = 60; // 1 минута

// Генерация ключа для списка аукционов
function getAuctionsCacheKey(options: GetAuctionsOptions): string {
  const { status, sellerId, page, limit } = options;
  return `auctions:list:${status || "all"}:${sellerId || "all"}:${page}:${limit}`;
}

// Генерация ключа для конкретного аукциона
function getAuctionCacheKey(id: number): string {
  return `auction:${id}`;
}

function getAuctionsListVersionKey(): string {
  return "auctions:list:version";
}

async function getAuctionsListVersion(): Promise<string> {
  const key = getAuctionsListVersionKey();
  const current = await safeRedis.get(key);
  if (current) return current;

  const initial = "1";
  await safeRedis.set(key, initial);
  return initial;
}

function serializeAuctionForCache(auction: Auction) {
  return {
    id: auction.id,
    title: auction.title,
    description: auction.description ?? null,
    imageUrl: auction.imageUrl ?? null,
    startingPrice: typeof auction.startingPrice === 'object' && 'toNumber' in auction.startingPrice 
      ? auction.startingPrice.toNumber() 
      : Number(auction.startingPrice),
    currentPrice: typeof auction.currentPrice === 'object' && 'toNumber' in auction.currentPrice 
      ? auction.currentPrice.toNumber() 
      : Number(auction.currentPrice),
    sellerId: auction.sellerId,
    currency: auction.currency,
    status: auction.status,
    createdAt: auction.createdAt instanceof Date 
      ? auction.createdAt.toISOString() 
      : typeof auction.createdAt === 'string' 
        ? auction.createdAt 
        : new Date(auction.createdAt).toISOString(),
    endsAt: auction.endsAt instanceof Date 
      ? auction.endsAt.toISOString() 
      : typeof auction.endsAt === 'string' 
        ? auction.endsAt 
        : new Date(auction.endsAt).toISOString(),
  };
}

function serializeAuctionsListForCache(result: {
  auctions: Auction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}) {
  return {
    auctions: result.auctions.map((auction: any) => serializeAuctionForCache(auction)),
    pagination: result.pagination,
  };
}

// Инвалидация кэша списков аукционов через версионирование ключей
async function invalidateAuctionsLists() {
  const versionKey = getAuctionsListVersionKey();
  await safeRedis.incr(versionKey);
}

// ========================================
// Типы
// ========================================

export interface GetAuctionsOptions {
  status?: string;
  sellerId?: number;
  page: number;
  limit: number;
}

export interface CreateAuctionInput {
  title: string;
  description?: string;
  imageUrl?: string | null;
  startingPrice: number;
  currency?: string;
  endsAt: string;
}

export interface UpdateAuctionInput {
  title?: string;
  description?: string;
  imageUrl?: string;
  startingPrice?: number;
  currency?: string;
  endsAt?: string;
}

/**
 * Получение списка аукционов
 */
export async function getAuctions(options: GetAuctionsOptions) {
  const version = await getAuctionsListVersion();
  const cacheKey = `${getAuctionsCacheKey(options)}:v${version}`;

  const cached = await safeRedis.get(cacheKey);
  if (cached) {
    const parsed = safeJsonParse(cached);
    if (parsed && validateAuctionsList(parsed)) {
      return parsed;
    }
    await safeRedis.del(cacheKey);
  }

  const { status, sellerId, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: Prisma.AuctionWhereInput = {};
  if (status) where.status = status as "ACTIVE" | "COMPLETED" | "CANCELLED";
  if (sellerId) where.sellerId = sellerId;

  const auctions = await getAuctionsRepo(prisma, where, skip, limit);
  const total = await getAuctionsCount(prisma, where);

  const result = {
    auctions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };

  const serialized = serializeAuctionsListForCache(result);
  await safeRedis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(serialized));

  return result;
}

/**
 * Получение конкретного аукциона
 */
export async function getAuctionById(id: number) {
  const cacheKey = getAuctionCacheKey(id);

  const cached = await safeRedis.get(cacheKey);
  if (cached) {
    const parsed = safeJsonParse(cached);
    if (parsed && validateAuction(parsed)) {
      return parsed;
    }
    await safeRedis.del(cacheKey);
  }

  const auction = await getAuctionByIdRepo(prisma, id);

  if (auction) {
    const serialized = serializeAuctionForCache(auction);
    await safeRedis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(serialized));
  }

  return auction;
}

/**
 * Создание нового аукциона
 */
export async function createAuction(data: CreateAuctionInput, userId: number) {
  // Очистка входных данных от потенциально опасного контента
  const sanitizedData = sanitizeObject(data, {
    skipKeys: ['endsAt', 'startingPrice'],
  });
  
  const { title, description, imageUrl, startingPrice, currency, endsAt } =
    sanitizedData;

  const endsAtDate = new Date(endsAt);
  if (isNaN(endsAtDate.getTime())) {
    throw createValidationError("Некорректная дата окончания");
  }
  if (endsAtDate <= new Date()) {
    throw createValidationError("Дата окончания должна быть в будущем");
  }

  // Валюта по умолчанию — usd
  const auctionCurrency = currency ? currency.toLowerCase() : "usd";

  const auction = await createAuctionRepo(prisma, {
    title,
    description,
    imageUrl: imageUrl || null,
    startingPrice: new Prisma.Decimal(startingPrice),
    currentPrice: new Prisma.Decimal(startingPrice),
    currency: auctionCurrency,
    sellerId: userId,
    endsAt: endsAtDate,
    status: "ACTIVE",
  });

  // Уведомление через WebSocket о новом аукционе
  getIo().emit("auction:new", auction);

  // Планирование завершения аукциона по времени
  scheduleAuctionCompletion(auction.id, endsAtDate);

  // Инвалидация кэша списков аукционов
  await invalidateAuctionsLists();

  return auction;
}

/**
 * Обновление аукциона
 */
export async function updateAuction(
  id: number,
  data: UpdateAuctionInput,
  userId: number,
) {
  // Очистка входных данных от потенциально опасного контента
  const sanitizedData = sanitizeObject(data, {
    skipKeys: ['endsAt', 'startingPrice'],
  });
  
  // Формируем данные для обновления
  const updateData: Prisma.AuctionUpdateInput = {};

  if (sanitizedData.title !== undefined) updateData.title = sanitizedData.title;
  if (sanitizedData.description !== undefined) updateData.description = sanitizedData.description;
  if (sanitizedData.imageUrl !== undefined) updateData.imageUrl = sanitizedData.imageUrl || null;
  if (sanitizedData.startingPrice !== undefined)
    updateData.startingPrice = sanitizedData.startingPrice;
  if (sanitizedData.currency !== undefined)
    updateData.currency = sanitizedData.currency.toLowerCase();

  if (data.endsAt) {
    const endsAtDate = new Date(data.endsAt);
    if (isNaN(endsAtDate.getTime())) {
      throw createValidationError("Некорректная дата окончания");
    }
    if (endsAtDate <= new Date()) {
      throw createValidationError("Дата окончания должна быть в будущем");
    }
    updateData.endsAt = endsAtDate;

    // Обновляем запланированное завершение аукциона
    await removeScheduledAuctionCompletion(id);
    scheduleAuctionCompletion(id, endsAtDate);
  }

  // Проверяем, существует ли аукцион и принадлежит ли он пользователю
  const existingAuction = await getAuctionByIdRepo(prisma, id);
  if (!existingAuction) {
    throw createNotFoundError("Аукцион не найден");
  }
  if (existingAuction.sellerId !== userId) {
    throw createForbiddenError(
      "Недостаточно прав для редактирования этого аукциона",
    );
  }
  if (existingAuction.status !== "ACTIVE") {
    throw createValidationError("Можно редактировать только активные аукционы");
  }

  const auction = await updateAuctionByIdRepo(prisma, id, updateData);

  // Уведомление через WebSocket об обновлении аукциона
  getIo().to(`auction:${id}`).emit("auction:updated", auction);

  await safeRedis.del(getAuctionCacheKey(id));
  await invalidateAuctionsLists();

  return auction;
}

/**
 * Удаление аукциона
 */
export async function deleteAuction(id: number, userId: number) {
  // Удаляем запланированное завершение аукциона
  await removeScheduledAuctionCompletion(id);

  // Атомарное удаление с проверкой владельца
  const deleted = await prisma.auction.deleteMany({
    where: {
      id,
      sellerId: userId,
    },
  });

  if (deleted.count === 0) {
    // Проверяем, существует ли аукцион вообще
    const exists = await getAuctionByIdRepo(prisma, id);
    if (!exists) {
      throw createNotFoundError("Аукцион не найден");
    } else {
      throw createForbiddenError(
        "Недостаточно прав для удаления этого аукциона",
      );
    }
  }

  // Уведомление через WebSocket об удалении аукциона
  getIo().to(`auction:${id}`).emit("auction:deleted", { id });

  await safeRedis.del(getAuctionCacheKey(id));
  await invalidateAuctionsLists();
}
