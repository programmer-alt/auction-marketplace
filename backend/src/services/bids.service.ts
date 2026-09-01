import { prisma } from "../config/db";
import { getIo } from "../config/socket";
import { createNotFoundError, createValidationError } from "../errors/factories";
import {
  getBidsByAuctionId as getBidsByAuctionIdRepo,
  getBidsCountByAuctionId as getBidsCountByAuctionIdRepo,
} from "../repositories/bids.repository";
import { Prisma } from "../types";
import type { BidWithRelations } from "../types";

// ========================================
// Типы
// ========================================

export interface GetBidsOptions {
  page: number;
  limit: number;
}

export interface CreateBidResult {
  bid: BidWithRelations;
  auction: Prisma.AuctionGetPayload<{
    include: {
      seller: { select: { id: true; email: true; name: true } };
      winner: { select: { id: true; email: true; name: true } };
    };
  }>;
}

export interface GetBidsResult {
  bids: Array<{
    id: number;
    auctionId: number;
    userId: number;
    amount: Prisma.Decimal;
    createdAt: Date;
    user: {
      id: number;
      email: string;
      name: string | null;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Создание ставки
 */
export async function createBid(
  auctionId: number,
  userId: number,
  amount: number,
  currency?: string,
): Promise<CreateBidResult> {
  const decimalAmount = new Prisma.Decimal(amount);
  const now = new Date();

  // Получаем auction для проверки endsAt и валюты
  const existingAuction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { endsAt: true, currency: true },
  });

  if (!existingAuction) {
    throw createNotFoundError("Аукцион не найден");
  }

  // Проверяем валюту ставки относительно валюты аукциона
  if (currency) {
    const normalizedCurrency = currency.toLowerCase();
    if (existingAuction.currency !== normalizedCurrency) {
      throw createValidationError(
        `Валюта ставки (${currency}) не совпадает с валютой аукциона (${existingAuction.currency})`,
      );
    }
  }

  // Определяем, вышло ли время аукциона (ранняя проверка для быстрого отказа)
  const auctionTimeEnded = new Date(existingAuction.endsAt) <= now;

  // Если время вышло — отклоняем сразу, аукцион мог ещё не быть обновлён фоновым джобом
  if (auctionTimeEnded) {
    throw createValidationError("Аукцион завершён — приём ставок невозможен");
  }

  // Повторная проверка внутри транзакции — защита от race condition
  // между ранней проверкой и моментом записи ставки
  try {
    const [updatedAuction, bid] = await prisma.$transaction([
      // Атомарное обновление аукциона с проверкой всех условий
      prisma.auction.update({
        where: {
          id: auctionId,
          status: "ACTIVE",
          endsAt: { gt: now }, // ← атомарная проверка времени
          currentPrice: { lt: decimalAmount },
          sellerId: { not: userId },
        },
        data: {
          currentPrice: decimalAmount,
          winnerId: userId,
        },
        include: {
          seller: {
            select: { id: true, email: true, name: true },
          },
          winner: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      // Создание ставки
      prisma.bid.create({
        data: {
          auctionId,
          userId,
          amount: decimalAmount,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          auction: {
            select: { id: true, title: true, currentPrice: true },
          },
        },
      }),
    ]);

    // Уведомление через WebSocket о новой ставке
    getIo().to(`auction:${auctionId}`).emit("bid:new", {
      bid,
      auction: updatedAuction,
    });

    return {
      bid,
      auction: updatedAuction,
    };
  } catch (error) {
    // Обработка ошибок Prisma
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      // Record not found - аукцион не удовлетворяет условиям
      throw createValidationError(
        "Невозможно сделать ставку: аукцион не найден, не активен, уже завершён, ставка слишком низкая или вы являетесь продавцом",
      );
    }
    throw error;
  }
}

/**
 * Получение истории ставок по аукциону
 */
export async function getBidsByAuction(auctionId: number, options: GetBidsOptions): Promise<GetBidsResult> {
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  // Проверяем существование аукциона
  const auctionExists = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true },
  });

  if (!auctionExists) {
    throw createNotFoundError("Аукцион не найден");
  }

  const bids = await getBidsByAuctionIdRepo(prisma, auctionId, skip, limit);

  const total = await getBidsCountByAuctionIdRepo(prisma, auctionId);

  return {
    bids,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
