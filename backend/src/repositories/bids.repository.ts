import { prisma } from "../index.js";

/**
 * ✅ ФУНКЦИОНАЛЬНЫЙ ПОДХОД
 * Чистые функции для работы со ставками
 */

// Создание ставки
export const createBid = async (data: any) => {
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
};

// Получение списка ставок по аукциону
export const getBidsByAuctionId = async (
  auctionId: number,
  skip: number,
  take: number,
) => {
  return await prisma.bid.findMany({
    where: { auctionId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { amount: "desc" },
    skip,
    take,
  });
};

// Подсчет количества ставок по аукциону
export const getBidsCountByAuctionId = async (auctionId: number) => {
  return await prisma.bid.count({ where: { auctionId } });
};

// Получение ставки по ID
export const getBidById = async (id: number) => {
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
};

// Удаление ставки
export const deleteBid = async (id: number) => {
  return await prisma.bid.delete({
    where: { id },
  });
};
