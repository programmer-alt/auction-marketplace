import type { PrismaClient } from "@prisma/client";
import type { BidWithRelations, CreateBidData } from "../types";

// Создание ставки
export const createBid = async (prisma: PrismaClient, data: CreateBidData) => {
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
  prisma: PrismaClient,
  auctionId: number,
  skip: number,
  take: number,
): Promise<BidWithRelations[]> => {
  return await prisma.bid.findMany({
    where: { auctionId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      auction: {
        select: { id: true, title: true, currentPrice: true },
      },
    },
    orderBy: { amount: "desc" },
    skip,
    take,
  });
};

// Подсчет количества ставок по аукциону
export const getBidsCountByAuctionId = async (prisma: PrismaClient, auctionId: number) => {
  return await prisma.bid.count({ where: { auctionId } });
};

// Получение ставки по ID
export const getBidById = async (prisma: PrismaClient, id: number) => {
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
export const deleteBid = async (prisma: PrismaClient, id: number) => {
  return await prisma.bid.delete({
    where: { id },
  });
};
