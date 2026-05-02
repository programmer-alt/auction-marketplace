import { Prisma, PrismaClient } from "@prisma/client";
import { createValidationError, createNotFoundError } from "../errors/factories";
import { createCursorWhereClause, createPaginationResult, parsePaginationOptions, CursorPaginationOptions, CursorPaginationResult } from "../utils/pagination";

// Получение списка аукционов с пагинацией
export const getAuctions = async (
  prisma: PrismaClient,
  where: Prisma.AuctionWhereInput,
  skip: number,
  take: number,
) => {
  // Валидация параметров пагинации
  if (
    skip < 0 ||
    take < 0 ||
    !Number.isInteger(skip) ||
    !Number.isInteger(take)
  ) {
    throw createValidationError("Invalid pagination parameters");
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
export const getAuctionsCount = async (
  prisma: PrismaClient,
  where: Prisma.AuctionWhereInput,
) => {
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

// Создание нового аукциона (unchecked version supports scalar foreign keys)
export const createAuction = async (
  prisma: PrismaClient,
  data: Prisma.AuctionUncheckedCreateInput,
) => {
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
  where: Prisma.AuctionWhereInput,
  data: Prisma.AuctionUpdateManyMutationInput,
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
  data: Prisma.AuctionUpdateInput,
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
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Record<string, unknown>).code === "P2025"
    ) {
      throw createNotFoundError(`Auction with id ${id} not found`);
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
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as Record<string, unknown>).code === "P2025"
    ) {
      throw createNotFoundError(`Auction with id ${id} not found`);
    }
    throw error;
  }
};

// ========================================
// Курсорная пагинация
// ========================================

/**
 * Получение списка аукционов с курсорной пагинацией
 */
export const getAuctionsWithCursor = async (
  prisma: PrismaClient,
  where: Prisma.AuctionWhereInput,
  options: CursorPaginationOptions,
): Promise<CursorPaginationResult<any>> => {
  const { cursor, limit, direction } = parsePaginationOptions(options);
  const cursorField = 'id';
  
  // Создаем условие для курсора
  const cursorWhere = createCursorWhereClause(cursor, cursorField, direction);
  
  // Объединяем условия
  const combinedWhere = {
    ...where,
    ...cursorWhere,
  };
  
  // Определяем порядок сортировки
  const orderBy = direction === 'next' 
    ? { [cursorField]: 'asc' as const }
    : { [cursorField]: 'desc' as const };
  
  // Получаем данные с запасом для определения hasMore
  const data = await prisma.auction.findMany({
    where: combinedWhere,
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
    orderBy,
    take: limit + 1, // Берем на один больше для определения hasMore
  });
  
  // Если направление назад, переворачиваем результат
  const sortedData = direction === 'prev' ? data.reverse() : data;
  
  return createPaginationResult(sortedData, limit, cursorField, direction);
};
