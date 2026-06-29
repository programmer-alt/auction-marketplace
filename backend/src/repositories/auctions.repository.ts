import { Prisma, PrismaClient } from "@prisma/client";
import { createValidationError, createNotFoundError } from "../errors/factories";
import {
  createCursorWhereClause,
  createPaginationResult,
  parsePaginationOptions,
  CursorPaginationOptions,
  CursorPaginationResult,
  CompositeCursorPaginationOptions,
  createCompositeCursorWhereClause,
  createCompositePaginationResult,
  parseCompositePaginationOptions,
  createOrderBy,
} from "../utils/pagination";

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
 * Поддерживает как одиночные, так и составные курсоры
 */
export const getAuctionsWithCursor = async (
  prisma: PrismaClient,
  where: Prisma.AuctionWhereInput,
  options: CursorPaginationOptions & { cursorField?: string; cursorFields?: string[] },
): Promise<CursorPaginationResult<any>> => {
  // Если указаны составные поля, используем составную пагинацию
  if (options.cursorFields && options.cursorFields.length > 0) {
    return getAuctionsWithCompositeCursor(prisma, where, {
      ...options,
      cursorFields: options.cursorFields,
    });
  }

  const { cursor, limit, direction } = parsePaginationOptions(options);
  const cursorField = options.cursorField || 'id';
  
  // Валидация типа значения курсора (опционально)
  if (cursor && typeof cursor === 'object' && cursorField in cursor) {
    const cursorValue = (cursor as Record<string, unknown>)[cursorField];
    if (typeof cursorValue !== 'string' && typeof cursorValue !== 'number' && !(cursorValue instanceof Date)) {
      // Если тип невалидный, игнорируем курсор
      console.warn(`Invalid cursor value type for field ${cursorField}`);
    }
  }
  
  // Создаем условие для курсора
  const cursorWhere = createCursorWhereClause(cursor, cursorField, direction);
  
  // Объединяем условия
  const combinedWhere = {
    ...where,
    ...cursorWhere,
  };
  
  // Определяем порядок сортировки с использованием createOrderBy для единообразия
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

/**
 * Получение списка аукционов с составной курсорной пагинацией
 */
export const getAuctionsWithCompositeCursor = async (
  prisma: PrismaClient,
  where: Prisma.AuctionWhereInput,
  options: CompositeCursorPaginationOptions,
): Promise<CursorPaginationResult<any>> => {
  const { cursor, limit, direction, cursorFields } = parseCompositePaginationOptions(options);
  
  // Создаем условие для составного курсора
  const cursorWhere = createCompositeCursorWhereClause(cursor, cursorFields, direction);
  
  // Объединяем условия
  const combinedWhere = {
    ...where,
    ...cursorWhere,
  };
  
  // Определяем порядок сортировки
  const orderBy = createOrderBy(cursorFields, direction);
  
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
    take: limit + 1,
  });
  
  // Если направление назад, переворачиваем результат
  const sortedData = direction === 'prev' ? data.reverse() : data;
  
  return createCompositePaginationResult(sortedData, limit, cursorFields, direction);
};
