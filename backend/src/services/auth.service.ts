import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../index";
import {
  getUserByEmail,
  createUser,
  getUserById,
} from "../repositories/users.repository";
import { createValidationError, createForbiddenError } from "../errors/factories";

// Helper для получения JWT секрета (проще подменять в тестах)
function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw createValidationError("JWT_SECRET is not configured");
  }
  return jwtSecret;
}

// ========================================
// Типы
// ========================================

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: number;
    email: string;
    name: string | null;
    balance?: Prisma.Decimal;
  };
  token: string;
}

/**
 * Регистрация пользователя
 */
export async function register(email: string, password: string, name?: string) {
  // Проверка, существует ли пользователь
  const existingUser = await getUserByEmail(prisma, email);
  if (existingUser) {
    throw createValidationError("Пользователь уже существует");
  }

  // Хеширование пароля
  const hashedPassword = await bcrypt.hash(password, 10);

  // Создание пользователя
  const user = await createUser(prisma, {
    email,
    password: hashedPassword,
    name,
  });

  // Генерация JWT токена
  const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: "7d",
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
  };
}

/**
 * Вход пользователя
 */
export async function login(email: string, password: string) {
  // Поиск пользователя
  const user = await getUserByEmail(prisma, email);
  if (!user) {
    throw createForbiddenError("Неверные учетные данные");
  }

  // Проверка пароля
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createForbiddenError("Неверные учетные данные");
  }

  // Генерация JWT токена
  const token = jwt.sign({ id: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: "7d",
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    },
    token,
  };
}

/**
 * Получение текущего пользователя
 */
export async function getCurrentUser(userId: number) {
  return await getUserById(prisma, userId);
}
