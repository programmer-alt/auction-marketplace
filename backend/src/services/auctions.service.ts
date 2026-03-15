import { prisma } from "../index";
import {
  getAuctions as getAuctionsRepo,
  getAuctionsCount,
  getAuctionById as getAuctionByIdRepo,
  createAuction as createAuctionRepo,
  updateAuctionById as updateAuctionByIdRepo,
  deleteAuction as deleteAuctionRepo,
} from "../repositories/auctions.repository";

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
  const { status, sellerId, page, limit } = options;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (sellerId) where.sellerId = sellerId;

  const auctions = await getAuctionsRepo(prisma, where, skip, limit);

  const total = await getAuctionsCount(prisma, where);

  return {
    auctions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
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
export async function createAuction(data: CreateAuctionData, userId: number) {
  const { title, description, imageUrl, startingPrice, currency, endsAt } =
    data;

  const endsAtDate = new Date(endsAt);
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
  const updateData: any = { ...data };
  if (data.endsAt) {
    const endsAtDate = new Date(data.endsAt);
    if (endsAtDate <= new Date()) {
      throw new Error("Дата окончания должна быть в будущем");
    }
    updateData.endsAt = endsAtDate;
  }
  if (data.currency) {
    updateData.currency = data.currency.toLowerCase();
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

  return auction;
}

/**
 * Удаление аукциона
 */
export async function deleteAuction(id: number, userId: number) {
  const existingAuction = await getAuctionByIdRepo(prisma, id);

  if (!existingAuction) {
    throw new Error("Аукцион не найден");
  }

  if (existingAuction.sellerId !== userId) {
    throw new Error("Недостаточно прав для удаления этого аукциона");
  }

  await deleteAuctionRepo(prisma, id);
}
