import { PrismaClient } from "@prisma/client";

// Получение списка аукционов с пагинацией
export const getAuctions = async (
  prisma: PrismaClient,
  where: any,
  skip: number,
  take: number,
) => {
  // Валидация параметров пагинации
  if (skip < 0 || take < 0 || !Number.isInteger(skip) || !Number.isInteger(take)) {
    throw new Error("Invalid pagination parameters");
  }
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
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
};

// Подсчет количества аукционов
export const getAuctionsCount = async (prisma: PrismaClient, where: any) => {
  return await prisma.auction.count({ where });
};

// Получение аукциона по ID
export const getAuctionById = async (prisma: PrismaClient, id: number) => {
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
        orderBy: { amount: "desc" },
      },
    },
  });
};

// Создание нового аукциона
export const createAuction = async (prisma: PrismaClient, data: any) => {
  return await prisma.auction.create({
    data,
    include: {
      seller: {
        select: { id: true, email: true, name: true },
      },
    },
  });
};

// Условное обновление аукциона
export const updateAuctionMany = async (
  prisma: PrismaClient,
  where: any,
  data: any,
) => {
  return await prisma.auction.updateMany({
    where,
    data,
  });
};

// Обновление аукциона по ID
export const updateAuctionById = async (
  prisma: PrismaClient,
  id: number,
  data: any,
) => {
  try {
    return await prisma.auction.update({
      where: { id },
      data,
      include: {
        seller: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error(`Auction with id ${id} not found`);
    }
    throw error;
  }
};

// Удаление аукциона
export const deleteAuction = async (prisma: PrismaClient, id: number) => {
  try {
    return await prisma.auction.delete({
      where: { id },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error(`Auction with id ${id} not found`);
    }
    throw error;
  }
};
