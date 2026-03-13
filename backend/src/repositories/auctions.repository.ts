import { prisma } from "../index.js";

/**
 * ✅ ФУНКЦИОНАЛЬНЫЙ ПОДХОД
 * Чистые функции для работы с аукционами
 */

// Получение списка аукционов с пагинацией
export const getAuctions = async (where: any, skip: number, take: number) => {
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
export const getAuctionsCount = async (where: any) => {
  return await prisma.auction.count({ where });
};

// Получение аукциона по ID
export const getAuctionById = async (id: number) => {
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
export const createAuction = async (data: any) => {
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
export const updateAuctionMany = async (where: any, data: any) => {
  return await prisma.auction.updateMany({
    where,
    data,
  });
};

// Обновление аукциона по ID
export const updateAuctionById = async (id: number, data: any) => {
  return await prisma.auction.update({
    where: { id },
    data,
    include: {
      seller: {
        select: { id: true, email: true, name: true },
      },
    },
  });
};

// Удаление аукциона
export const deleteAuction = async (id: number) => {
  return await prisma.auction.delete({
    where: { id },
  });
};
