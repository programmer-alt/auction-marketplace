import { PrismaClient } from "@prisma/client";

/**
 * ✅ ФУНКЦИОНАЛЬНЫЙ ПОДХОД
 * Чистые функции для работы с пользователями
 */

// Поиск пользователя по email
export const getUserByEmail = async (email: string) => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

// Поиск пользователя по ID
export const getUserById = async (id: number) => {
  return await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      balance: true,
      createdAt: true,
    },
  });
};

// Создание пользователя
export const createUser = async (data: any) => {
  return await prisma.user.create({
    data,
  });
};

// Обновление пользователя
export const updateUser = async (id: number, data: any) => {
  return await prisma.user.update({
    where: { id },
    data,
  });
};

// Удаление пользователя
export const deleteUser = async (id: number) => {
  return await prisma.user.delete({
    where: { id },
  });
};
