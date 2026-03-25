import { prisma } from "../index";
import { io } from "../index";
import {
  getBidsByAuctionId as getBidsByAuctionIdRepo,
  getBidsCountByAuctionId as getBidsCountByAuctionIdRepo,
} from "../repositories/bids.repository";
import { Prisma } from "@prisma/client";
import { BidWithRelations } from "../types";
import { ValidationError, NotFoundError } from "../errors";

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
  // Проверяем валюту ставки относительно валюты аукциона
  if (currency) {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { currency: true },
    });
    if (auction && auction.currency !== currency.toLowerCase()) {
      throw new ValidationError(`Валюта ставки (${currency}) не совпадает с валютой аукциона (${auction.currency})`);
    }
  }

  try {
    const [updatedAuction, bid] = await prisma.$transaction([
      // Атомарное обновление аукциона с проверкой всех условий
      prisma.auction.update({
        where: {
          id: auctionId,
          status: 'ACTIVE',
          endsAt: { gt: new Date() },
          currentPrice: { lt: amount },
          sellerId: { not: userId },
        },
        data: { currentPrice: amount, winnerId: userId },
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
          amount,
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
    io.to(`auction:${auctionId}`).emit("bid:new", {
      bid,
      auction: updatedAuction,
    });

    return {
      bid,
      auction: updatedAuction,
    };
  } catch (error) {
    // Обработка ошибок Prisma
    if (error instanceof Error && 'code' in error && error.code === 'P2025') {
      // Record not found - аукцион не удовлетворяет условиям
      throw new ValidationError("Невозможно сделать ставку: аукцион не найден, не активен, уже завершён, ставка слишком низкая или вы являетесь продавцом");
    }
    throw error;
  }
}

/**
 * Получение истории ставок по аукциону
 */
export async function getBidsByAuction(
  auctionId: number,
  options: GetBidsOptions,
): Promise<GetBidsResult> {
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  // Проверяем существование аукциона
  const auctionExists = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true },
  });

  if (!auctionExists) {
    throw new NotFoundError("Аукцион не найден");
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