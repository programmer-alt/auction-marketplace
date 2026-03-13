import { prisma } from '../index';
import { io } from '../index';

interface GetBidsOptions {
  page: number;
  limit: number;
}

export class BidsService {
  // Создание ставки
  async createBid(auctionId: number, userId: number, amount: number) {
    // Получаем аукцион с текущей ценой
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        seller: true,
        winner: true,
      },
    });

    if (!auction) {
      throw new Error('Аукцион не найден');
    }

    // Проверка статуса аукциона
    if (auction.status !== 'ACTIVE') {
      throw new Error('Аукцион не активен');
    }

    // Проверка, что аукцион ещё не завершился
    if (auction.endsAt < new Date()) {
      throw new Error('Аукцион уже завершён');
    }

    // Проверка, что ставка выше текущей цены
    if (amount <= auction.currentPrice.toNumber()) {
      throw new Error('Ставка должна быть выше текущей цены');
    }

    // Проверка, что пользователь не является продавцом
    if (auction.sellerId === userId) {
      throw new Error('Вы не можете делать ставки на свои аукционы');
    }

    // Создание ставки
    const bid = await prisma.bid.create({
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
    });

    // Обновление текущей цены аукциона
    const updatedAuction = await prisma.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
        winner: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    // Уведомление через WebSocket о новой ставке
    io.to(`auction:${auctionId}`).emit('bid:new', {
      bid,
      auction: updatedAuction,
    });

    return {
      bid,
      auction: updatedAuction,
    };
  }

  // Получение истории ставок по аукциону
  async getBidsByAuction(auctionId: number, options: GetBidsOptions) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Проверяем существование аукциона
    const auctionExists = await prisma.auction.findUnique({
      where: { id: auctionId },
      select: { id: true },
    });

    if (!auctionExists) {
      throw new Error('Аукцион не найден');
    }

    const bids = await prisma.bid.findMany({
      where: { auctionId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { amount: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.bid.count({ where: { auctionId } });

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
}
