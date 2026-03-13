import { prisma } from '../index';

export class AuctionsRepository {
  // Получение списка аукционов
  async findAll(where: any, skip: number, take: number) {
    return await prisma.auction.findMany({
      where,
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
        winner: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { bids: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  // Подсчет количества аукционов
  async count(where: any) {
    return await prisma.auction.count({ where });
  }

  // Получение аукциона по ID
  async findById(id: number) {
    return await prisma.auction.findUnique({
      where: { id },
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
          orderBy: { amount: 'desc' },
        },
      },
    });
  }

  // Создание нового аукциона
  async create(data: any) {
    return await prisma.auction.create({
      data,
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  // Обновление аукциона
  async updateMany(where: any, data: any) {
    return await prisma.auction.updateMany({
      where,
      data,
    });
  }

  // Обновление аукциона по ID
  async updateById(id: number, data: any) {
    return await prisma.auction.update({
      where: { id },
      data,
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  // Удаление аукциона
  async delete(id: number) {
    return await prisma.auction.delete({
      where: { id },
    });
  }
}
