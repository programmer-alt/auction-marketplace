import { prisma } from '../index';

export class BidsRepository {
  // Создание ставки
  async create(data: any) {
    return await prisma.bid.create({
      data,
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true },
        },
      },
    });
  }

  // Получение списка ставок по аукциону
  async findByAuctionId(auctionId: number, skip: number, take: number) {
    return await prisma.bid.findMany({
      where: { auctionId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { amount: 'desc' },
      skip,
      take,
    });
  }

  // Подсчет количества ставок по аукциону
  async countByAuctionId(auctionId: number) {
    return await prisma.bid.count({ where: { auctionId } });
  }

  // Получение ставки по ID
  async findById(id: number) {
    return await prisma.bid.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true },
        },
      },
    });
  }

  // Удаление ставки
  async delete(id: number) {
    return await prisma.bid.delete({
      where: { id },
    });
  }
}
