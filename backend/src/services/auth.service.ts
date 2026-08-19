import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { Prisma } from "../types";
import { prisma } from "../config/db";
import logger from "../config/logger";
import {
  getUserByEmail,
  createUser,
  getUserById,
} from "../repositories/users.repository";
import { createValidationError, createForbiddenError } from "../errors/factories";

import { getJwtSecret, getJwtAccessExpiresIn, getJwtRefreshExpiresIn, maskEmail } from "../config/jwt";

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
  accessToken: string;
  refreshToken: string;
}

/**
 * Генерация пары токенов (access + refresh)
 */
function generateTokens(userId: number, email: string, role: string) {
  const secret = getJwtSecret();

  // Общие поля полезной нагрузки
  const basePayload = { id: userId, email, role };

  const accessExpiresIn = getJwtAccessExpiresIn();
  const refreshExpiresIn = getJwtRefreshExpiresIn();

  // По умолчанию access-токен живет заметнее, чем refresh-токен.
  // Если значения не заданы в конфиге, используем "1h" для access и "7d" для refresh.
  const safeAccessExpiresIn = accessExpiresIn ?? "1h";
  const safeRefreshExpiresIn = refreshExpiresIn ?? "7d";

  // ВАЖНО: refresh() на сервере ожидает payload.type === 'refresh'
  const accessToken = jwt.sign(
    { ...basePayload, type: 'access' },
    secret,
    { expiresIn: safeAccessExpiresIn } as SignOptions,
  );

  const refreshToken = jwt.sign(
    { ...basePayload, type: 'refresh' },
    secret,
    { expiresIn: safeRefreshExpiresIn } as SignOptions,
  );

  return { accessToken, refreshToken };
}

/**
 * Регистрация пользователя
 */
export async function register(email: string, password: string, name?: string) {
  const maskedEmail = maskEmail(email.trim());
  logger.info('[REGISTER] Попытка регистрации', { email: maskedEmail });

  // Проверка, существует ли пользователь
  const existingUser = await getUserByEmail(prisma, email);
  if (existingUser) {
    logger.warn('[REGISTER] Пользователь уже существует', { email: maskedEmail });
    throw createValidationError("Пользователь уже существует");
  }

  logger.info('[REGISTER] Пользователь не найден, создаем новый аккаунт', { email: maskedEmail });

  // Хеширование пароля
  const hashedPassword = await bcrypt.hash(password, 10);

  // Создание пользователя
  const user = await createUser(prisma, {
    email,
    password: hashedPassword,
    name,
  });

  logger.info('[REGISTER] Пользователь создан', { userId: user.id, email: maskEmail(user.email) });

  // Генерация пары токенов
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Вход пользователя
 */
export async function login(email: string, password: string) {
  // Маскирование email для логов (чтобы не логировать полный адрес)
  const maskedEmail = maskEmail(email);

  logger.info('[LOGIN] Попытка входа', { email: maskedEmail });

  // Поиск пользователя
  const user = await getUserByEmail(prisma, email);
  if (!user) {
    logger.warn('[LOGIN] Пользователь не найден', { email: maskedEmail });
    throw createForbiddenError("Неверные учетные данные");
  }

  logger.info('[LOGIN] Пользователь найден', { userId: user.id, email: maskedEmail });

  // Проверка пароля
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    logger.warn('[LOGIN] Неверный пароль', { email: maskedEmail });
    throw createForbiddenError("Неверные учетные данные");
  }

  logger.info('[LOGIN] Успешный вход', { userId: user.id, email: maskedEmail });

  // Генерация пары токенов
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Обновление access токена с помощью refresh токена
 */
export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, getJwtSecret()) as jwt.JwtPayload;
  } catch (err) {
    throw createForbiddenError("Неверный refresh токен");
  }
  if (payload.type !== 'refresh') {
    throw createForbiddenError("Токен не является refresh токеном");
  }
  const userId = payload.id;
  const {email, role} = payload;
  const {accessToken: newAccessToken, refreshToken: newRefreshToken} = generateTokens(userId, email, role);
  return {accessToken: newAccessToken, refreshToken: newRefreshToken};
}

/**
 * Выход пользователя
 */
export async function logout() {
  // Больше не инвалидирует токены — отзыв только через истечение срока JWT
}

/**
 * Получение текущего пользователя
 */
export async function getCurrentUser(userId: number) {
  return await getUserById(prisma, userId);
}
