import { prisma } from "../config/db";
import { getIo } from "../config/socket";
import {
  createAuction as createAuctionRepo,
  getAuctionById as getAuctionByIdRepo,
  getAuctionsCount,
  getAuctions as getAuctionsRepo,
  updateAuctionById as updateAuctionByIdRepo,
} from "../repositories/auctions.repository";

import { Prisma } from "../types";
import { sanitizeObject } from "../utils/sanitization";

// Тип для одиночного аукциона (с детальными ставками)
type SingleAuction = Prisma.AuctionGetPayload<{
  include: {
    seller: {
      select: {
        id: true;
        email: true;
        name: true;
      };
    };
    winner: {
      select: {
        id: true;
        email: true;
        name: true;
      };
    };
    bids: {
      include: {
        user: {
          select: {
            id: true;
            email: true;
            name: true;
          };
        };
      };
    };
  };
}>;

import { createForbiddenError, createNotFoundError, createValidationError } from "../errors/factories";

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
  const { status, sellerId, page, limit } = options;
  const skip = (page - 1) * limit;
  const where: Prisma.AuctionWhereInput = {};

  // Валидация status - принимаем только валидные enum значения
  if (status) {
    const validStatuses = ["ACTIVE", "COMPLETED", "CANCELLED"];
    const statusUpper = status.toUpperCase();
    if (validStatuses.includes(statusUpper)) {
      where.status = statusUpper as "ACTIVE" | "COMPLETED" | "CANCELLED";
    }
    // Если статус невалидный, просто игнорируем фильтр
  }

  if (sellerId) where.sellerId = sellerId;

  const auctions = await getAuctionsRepo(prisma, where, skip, limit);
  const total = await getAuctionsCount(prisma, where);
  return { auctions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/**
 * Получение конкретного аукциона
 */
export async function getAuctionById(id: number) {
  return await getAuctionByIdRepo(prisma, id);
}

/**
 * Создание нового аукциона
 */
export async function createAuction(data: CreateAuctionInput, userId: number) {
  // Очистка входных данных от потенциально опасного контента
  const sanitizedData = sanitizeObject(data as unknown as Record<string, unknown>, {
    skipKeys: ["endsAt", "startingPrice"],
  }) as unknown as CreateAuctionInput;

  const { title, description, imageUrl, startingPrice, currency, endsAt } = sanitizedData;

  const endsAtDate = new Date(endsAt);
  if (Number.isNaN(endsAtDate.getTime())) {
    throw createValidationError("Некорректная дата окончания");
  }
  if (endsAtDate <= new Date()) {
    throw createValidationError("Дата окончания должна быть в будущем");
  }

  // Валюта по умолчанию — usd
  const auctionCurrency = currency && typeof currency === "string" ? currency.toLowerCase() : "usd";

  const auction = await createAuctionRepo(prisma, {
    title: title as string,
    description: description as string | null,
    imageUrl: (imageUrl as string | null) || null,
    startingPrice: new Prisma.Decimal(startingPrice as number),
    currentPrice: new Prisma.Decimal(startingPrice as number),
    currency: auctionCurrency,
    sellerId: userId,
    endsAt: endsAtDate,
    status: "ACTIVE",
  });

  // Уведомление через WebSocket о новом аукционе
  getIo().emit("auction:new", auction);

  return auction;
}

/**
 * Вспомогательная функция для построения объекта обновления аукциона
 */
function buildUpdateData(sanitizedData: UpdateAuctionInput): Prisma.AuctionUpdateInput {
  const updateData: Prisma.AuctionUpdateInput = {};

  if (sanitizedData.title !== undefined) updateData.title = sanitizedData.title;
  if (sanitizedData.description !== undefined) updateData.description = sanitizedData.description;
  if (sanitizedData.imageUrl !== undefined) updateData.imageUrl = sanitizedData.imageUrl || null;
  if (sanitizedData.startingPrice !== undefined) updateData.startingPrice = sanitizedData.startingPrice;
  if (sanitizedData.currency !== undefined) updateData.currency = sanitizedData.currency.toLowerCase();

  return updateData;
}

/**
 * Валидация и обработка даты окончания аукциона
 * Возвращает объект с полем endsAt (если дата валидна) и флагом needsReschedule
 */
async function processEndsAt(
  endsAt: string | undefined,
  _auctionId: number,
): Promise<{ endsAtDate?: Date; needsReschedule: boolean }> {
  if (!endsAt) {
    return { needsReschedule: false };
  }

  const endsAtDate = new Date(endsAt);
  if (Number.isNaN(endsAtDate.getTime())) {
    throw createValidationError("Некорректная дата окончания");
  }
  if (endsAtDate <= new Date()) {
    throw createValidationError("Дата окончания должна быть в будущем");
  }

  return { endsAtDate, needsReschedule: true };
}

/**
 * Проверка прав доступа и состояния аукциона
 */
function validateAuctionForUpdate(existingAuction: SingleAuction, userId: number): void {
  if (existingAuction.sellerId !== userId) {
    throw createForbiddenError("Недостаточно прав для редактирования этого аукциона");
  }
  if (existingAuction.status !== "ACTIVE") {
    throw createValidationError("Можно редактировать только активные аукционы");
  }
}

/**
 * Обновление аукциона
 */
export async function updateAuction(id: number, data: UpdateAuctionInput, userId: number) {
  // Очистка входных данных от потенциально опасного контента
  const sanitizedData = sanitizeObject(data as unknown as Record<string, unknown>, {
    skipKeys: ["endsAt", "startingPrice"],
  }) as unknown as UpdateAuctionInput;

  // Формируем данные для обновления
  const updateData = buildUpdateData(sanitizedData);

  // Обработка даты окончания
  const { endsAtDate } = await processEndsAt(data.endsAt, id);
  if (endsAtDate) {
    updateData.endsAt = endsAtDate;
  }

  // Проверяем, существует ли аукцион и принадлежит ли он пользователю
  const existingAuction = await getAuctionByIdRepo(prisma, id);
  if (!existingAuction) {
    throw createNotFoundError("Аукцион не найден");
  }
  validateAuctionForUpdate(existingAuction, userId);

  const auction = await updateAuctionByIdRepo(prisma, id, updateData);

  // Уведомление через WebSocket об обновлении аукциона
  getIo().to(`auction:${id}`).emit("auction:updated", auction);

  return auction;
}

/**
 * Завершение аукциона (ручное)
 * Устанавливает статус COMPLETED, если аукцион истёк по времени и есть победитель
 */
export async function completeAuction(id: number, userId: number) {
  const existingAuction = await getAuctionByIdRepo(prisma, id);
  if (!existingAuction) {
    throw createNotFoundError("Аукцион не найден");
  }

  // Проверяем, что пользователь является владельцем аукциона
  if (existingAuction.sellerId !== userId) {
    throw createForbiddenError("Недостаточно прав для завершения этого аукциона");
  }

  // Проверяем, что аукцион ещё не завершён
  if (existingAuction.status !== "ACTIVE") {
    throw createValidationError("Аукцион уже завершён или отменён");
  }

  // Проверяем, что время вышло
  if (new Date(existingAuction.endsAt) > new Date()) {
    throw createValidationError("Время аукциона ещё не вышло");
  }

  // Проверяем, что есть победитель
  if (!existingAuction.winnerId) {
    throw createValidationError("Нет победителя для завершения");
  }

  // Обновляем статус на COMPLETED
  const updatedAuction = await prisma.auction.update({
    where: { id },
    data: { status: "COMPLETED" },
    include: {
      seller: {
        select: { id: true, email: true, name: true },
      },
      winner: {
        select: { id: true, email: true, name: true },
      },
      bids: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { amount: "desc" },
      },
    },
  });

  // Уведомление через WebSocket о завершении аукциона
  getIo().to(`auction:${id}`).emit("auction:completed", { id, status: "COMPLETED" });

  return updatedAuction;
}

/**
 * Автоматическое завершение всех истёкших аукционов с победителем
 */
export async function autoCompleteExpiredAuctions() {
  const now = new Date();

  // Находим все активные аукционы, у которых время вышло и есть победитель
  const expiredAuctions = await prisma.auction.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: now },
      winnerId: { not: null },
    },
    select: { id: true },
  });

  const updated: number[] = [];

  for (const auction of expiredAuctions) {
    await prisma.auction.update({
      where: { id: auction.id },
      data: { status: "COMPLETED" },
    });
    updated.push(auction.id);

    // Уведомление через WebSocket
    getIo().to(`auction:${auction.id}`).emit("auction:completed", { id: auction.id, status: "COMPLETED" });
  }

  return updated;
}

/**
 * Удаление аукциона
 */
export async function deleteAuction(id: number, userId: number) {
  // Проверяем, существует ли аукцион и принадлежит ли он пользователю
  const existingAuction = await getAuctionByIdRepo(prisma, id);
  if (!existingAuction) {
    throw createNotFoundError("Аукцион не найден");
  }

  // Проверяем, что пользователь является владельцем аукциона
  if (existingAuction.sellerId !== userId) {
    throw createForbiddenError("Недостаточно прав для удаления этого аукциона");
  }

  // Проверяем, что аукцион находится в активном состоянии
  if (existingAuction.status !== "ACTIVE") {
    throw createValidationError("Можно удалять только активные аукционы");
  }

  // Атомарное удаление с проверкой владельца и статуса
  const deleted = await prisma.auction.deleteMany({
    where: {
      id,
      sellerId: userId,
      status: "ACTIVE", // Дополнительно проверяем статус на уровне базы данных
    },
  });

  if (deleted.count === 0) {
    // Проверяем, существует ли аукцион вообще
    const exists = await getAuctionByIdRepo(prisma, id);
    if (!exists) {
      throw createNotFoundError("Аукцион не найден");
    }
    if (exists.sellerId !== userId) {
      throw createForbiddenError("Недостаточно прав для удаления этого аукциона");
    }
    if (exists.status !== "ACTIVE") {
      throw createValidationError("Можно удалять только активные аукционы");
    }
  }

  // Уведомление через WebSocket об удалении аукциона
  getIo().to(`auction:${id}`).emit("auction:deleted", { id });
}
