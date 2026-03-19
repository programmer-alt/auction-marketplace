import { prisma, io } from "../index";
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
import { redis } from "../redis";

// ========================================
// Безопасный парсинг JSON с валидацией
// ========================================

/**
 * Безопасно парсит JSON строку с ограничением глубины и обработкой ошибок.
 * @param text JSON строка
 * @param maxDepth Максимальная допустимая глубина (по умолчанию 20)
 * @returns Распарсенный объект или null при ошибке
 */
function safeJsonParse<T = any>(text: string, maxDepth = 20): T | null {
  if (typeof text !== "string") {
    return null;
  }

  // Проверка на чрезмерно длинную строку (защита от DoS)
  if (text.length > 10_000_000) {
    console.warn("JSON string too long, rejecting");
    return null;
  }

  let depth = 0;
  const reviver = (key: string, value: any) => {
    // Отслеживание глубины
    if (typeof value === "object" && value !== null) {
      depth++;
      if (depth > maxDepth) {
        throw new Error("Максимум глубина аукциона превышена");
      }
    }
    // Защита от прототипного загрязнения: отклоняем свойства __proto__ и constructor
    if (key === "__proto__" || key === "constructor") {
      return undefined;
    }
    return value;
  };

  try {
    depth = 0;
    return JSON.parse(text, reviver);
  } catch (err) {
    console.warn("Failed to parse JSON from cache:", err);
    return null;
  }
}

/**
 * Валидирует объект аукциона (базовые проверки).
 * @param obj Объект для проверки
 * @returns true если объект похож на аукцион
 */
function validateAuction(obj: any): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  // Проверяем наличие обязательных полей аукциона
  if (
    typeof obj.id !== "number" ||
    typeof obj.title !== "string" ||
    typeof obj.startingPrice !== "number" ||
    typeof obj.sellerId !== "number" ||
    !obj.createdAt ||
    !obj.endsAt
  ) {
    return false;
  }
  return true;
}

/**
 * Валидирует структуру кэшированного списка аукционов.
 * @param obj Объект для проверки
 * @returns true если структура корректна
 */
function validateAuctionsList(obj: any): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  if (!Array.isArray(obj.auctions) || typeof obj.pagination !== "object") {
    return false;
  }
  const { pagination } = obj;
  if (
    typeof pagination.page !== "number" ||
    typeof pagination.limit !== "number" ||
    typeof pagination.total !== "number" ||
    typeof pagination.totalPages !== "number"
  ) {
    return false;
  }
  // Дополнительно можно проверить каждый аукцион в массиве, но для производительности пропустим
  return true;
}

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

// Удаление всех кэшированных списков аукционов
async function invalidateAuctionsLists() {
  const keys = await redis.keys("auctions:list:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
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

export interface CreateAuctionData {
  title: string;
  description?: string;
  imageUrl?: string;
  startingPrice: number;
  currency?: string;
  endsAt: string;
}

export interface UpdateAuctionData {
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
  const cacheKey = getAuctionsCacheKey(options);

  // Пытаемся получить данные из кэша
  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = safeJsonParse(cached);
    if (parsed && validateAuctionsList(parsed)) {
      return parsed;
    }
    // Если кэш повреждён, удаляем его
    await redis.del(cacheKey);
  }

  const { status, sellerId, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
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

  // Сохраняем в кэш с TTL
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(result));

  return result;
}

/**
 * Получение конкретного аукциона
 */
export async function getAuctionById(id: number) {
  const cacheKey = getAuctionCacheKey(id);

  // Пытаемся получить данные из кэша
  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = safeJsonParse(cached);
    if (parsed && validateAuction(parsed)) {
      return parsed;
    }
    // Если кэш повреждён, удаляем его
    await redis.del(cacheKey);
  }

  const auction = await getAuctionByIdRepo(prisma, id);

  // Сохраняем в кэш только если аукцион найден
  if (auction) {
    await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(auction));
  }

  return auction;
}

/**
 * Создание нового аукциона
 */
export async function createAuction(data: CreateAuctionData, userId: number) {
  const { title, description, imageUrl, startingPrice, currency, endsAt } =
    data;

  const endsAtDate = new Date(endsAt);
  if (isNaN(endsAtDate.getTime())) {
    throw new Error("Некорректная дата окончания");
  }
  if (endsAtDate <= new Date()) {
    throw new Error("Дата окончания должна быть в будущем");
  }

  // Валюта по умолчанию — usd
  const auctionCurrency = currency ? currency.toLowerCase() : "usd";

  const auction = await createAuctionRepo(prisma, {
    title,
    description,
    imageUrl: imageUrl || null,
    startingPrice,
    currentPrice: startingPrice,
    currency: auctionCurrency,
    sellerId: userId,
    endsAt: endsAtDate,
    status: "ACTIVE",
  });

  // Уведомление через WebSocket о новом аукционе
  io.emit("auction:new", auction);

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
  data: UpdateAuctionData,
  userId: number,
) {
  // Разрешённые поля для обновления
  const allowedFields = [
    "title",
    "description",
    "imageUrl",
    "startingPrice",
    "currency",
    "endsAt",
  ];
  const updateData: any = {};

  for (const field of allowedFields) {
    if (data[field as keyof UpdateAuctionData] !== undefined) {
      updateData[field] = data[field as keyof UpdateAuctionData];
    }
  }

  if (updateData.endsAt) {
    const endsAtDate = new Date(updateData.endsAt);
    if (isNaN(endsAtDate.getTime())) {
      throw new Error("Некорректная дата окончания");
    }
    if (endsAtDate <= new Date()) {
      throw new Error("Дата окончания должна быть в будущем");
    }
    updateData.endsAt = endsAtDate;

    // Обновляем запланированное завершение аукциона
    await removeScheduledAuctionCompletion(id);
    scheduleAuctionCompletion(id, endsAtDate);
  }
  if (updateData.currency) {
    updateData.currency = updateData.currency.toLowerCase();
  }

  // Проверяем, существует ли аукцион и принадлежит ли он пользователю
  const existingAuction = await getAuctionByIdRepo(prisma, id);
  if (!existingAuction) {
    throw new Error("Аукцион не найден");
  }
  if (existingAuction.sellerId !== userId) {
    throw new Error("Недостаточно прав для редактирования этого аукциона");
  }
  if (existingAuction.status !== "ACTIVE") {
    throw new Error("Можно редактировать только активные аукционы");
  }

  const auction = await updateAuctionByIdRepo(prisma, id, updateData);

  // Уведомление через WebSocket об обновлении аукциона
  io.to(`auction:${id}`).emit("auction:updated", auction);

  // Инвалидация кэша
  await redis.del(getAuctionCacheKey(id));
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
      throw new Error("Аукцион не найден");
    } else {
      throw new Error("Недостаточно прав для удаления этого аукциона");
    }
  }

  // Уведомление через WebSocket об удалении аукциона
  io.to(`auction:${id}`).emit("auction:deleted", { id });

  // Инвалидация кэша
  await redis.del(getAuctionCacheKey(id));
  await invalidateAuctionsLists();
}
