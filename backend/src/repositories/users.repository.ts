import type { PrismaClient } from "@prisma/client";
import { runWithRetry } from "../config/db";
import type { CreateUserData, UpdateUserData } from "../types";

// Поиск пользователя по email
export const getUserByEmail = async (prisma: PrismaClient, email: string) => {
  return await runWithRetry(() => prisma.user.findUnique({ where: { email } }));
};

// Поиск пользователя по ID
export const getUserById = async (prisma: PrismaClient, id: number) => {
  return await runWithRetry(() =>
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        balance: true,
        createdAt: true,
      },
    }),
  );
};

// Создание пользователя
export const createUser = async (prisma: PrismaClient, data: CreateUserData) => {
  return await runWithRetry(() => prisma.user.create({ data }));
};

// Обновление пользователя
export const updateUser = async (prisma: PrismaClient, id: number, data: UpdateUserData) => {
  return await runWithRetry(() => prisma.user.update({ where: { id }, data }));
};

// Удаление пользователя
export const deleteUser = async (prisma: PrismaClient, id: number) => {
  return await runWithRetry(() => prisma.user.delete({ where: { id } }));
};
