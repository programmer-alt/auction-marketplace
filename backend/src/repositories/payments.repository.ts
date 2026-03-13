import { PrismaClient } from "@prisma/client";

/**
 * ✅ ФУНКЦИОНАЛЬНЫЙ ПОДХОД
 * Чистые функции для работы с платежами
 */

// Создание платежа
export const createPayment = async (prisma: PrismaClient, data: any) => {
  return await prisma.payment.create({
    data,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      auction: {
        select: { id: true, title: true, currentPrice: true, currency: true },
      },
    },
  });
};

// Поиск платежа по stripePaymentId
export const getPaymentByStripeId = async (prisma: PrismaClient, stripePaymentId: string) => {
  return await prisma.payment.findFirst({
    where: { stripePaymentId },
  });
};

// Обновление платежа
export const updatePayment = async (prisma: PrismaClient, id: number, data: any) => {
  return await prisma.payment.update({
    where: { id },
    data,
  });
};

// Получение списка платежей пользователя
export const getPaymentsByUserId = async (prisma: PrismaClient,
  userId: number,
  skip: number,
  take: number,
) => {
  return await prisma.payment.findMany({
    where: { userId },
    include: {
      auction: {
        select: {
          id: true,
          title: true,
          imageUrl: true,
          seller: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });
};

// Подсчет количества платежей пользователя
export const getPaymentsCountByUserId = async (prisma: PrismaClient, userId: number) => {
  return await prisma.payment.count({ where: { userId } });
};

// Получение платежа по ID
export const getPaymentById = async (prisma: PrismaClient, id: number) => {
  return await prisma.payment.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
      auction: {
        select: { id: true, title: true, currentPrice: true, currency: true },
      },
    },
  });
};

// Удаление платежа
export const deletePayment = async (prisma: PrismaClient, id: number) => {
  return await prisma.payment.delete({
    where: { id },
  });
};
