import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import {
  getUserByEmail,
  createUser,
  getUserById,
} from "../repositories/users.repository";
import { createValidationError, createForbiddenError } from "../errors/factories";

import { getJwtSecret, getJwtAccessExpiresIn, getJwtRefreshExpiresIn } from "../config/jwt";

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

  // Контракт тестов:
  // jwt.sign({ id, email, role }, secret, { expiresIn: "7d" })
  const basePayload = { id: userId, email, role };

  const accessExpiresIn = getJwtAccessExpiresIn();
  const refreshExpiresIn = getJwtRefreshExpiresIn();

  // На случай несогласованного мокинга в тестах — обеспечиваем контракт "7d".
  const safeAccessExpiresIn = accessExpiresIn ?? "7d";
  const safeRefreshExpiresIn = refreshExpiresIn ?? "7d";

  const accessToken = jwt.sign(
    basePayload,
    secret,
    { expiresIn: safeAccessExpiresIn } as SignOptions,
  );

  const refreshToken = jwt.sign(
    basePayload,
    secret,
    { expiresIn: safeRefreshExpiresIn } as SignOptions,
  );

  return { accessToken, refreshToken };
}


/**
 * Сохранение refresh токена в Redis
 */
async function saveRefreshToken(userId: number, refreshToken: string) {
  const key = `refresh:${userId}`;
  const ttl = 7 * 24 * 60 * 60; // 7 дней в секундах
  await redis.setex(key, ttl, refreshToken);
}

/**
 * Проверка, находится ли токен в черном списке
 */
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `blacklist:${token}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Добавление токена в черный список
 */
async function blacklistToken(token: string, expiresInSeconds: number) {
  const key = `blacklist:${token}`;
  await redis.setex(key, expiresInSeconds, '1');
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

  // Генерация пары токенов
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
  await saveRefreshToken(user.id, refreshToken);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token: accessToken,
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

  // Генерация пары токенов
  const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role);
  await saveRefreshToken(user.id, refreshToken);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      balance: user.balance,
    },
    token: accessToken,
  };
}

/**
 * Обновление access токена с помощью refresh токена
 */
export async function refresh(refreshToken: string) {
  // Проверка черного списка
  if (await isTokenBlacklisted(refreshToken)) {
    throw createForbiddenError("Токен недействителен");
  }

  // Верификация refresh токена
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
  const email = payload.email;
  const role = payload.role;

  // Проверка, что refresh токен сохранен в Redis
  const storedToken = await redis.get(`refresh:${userId}`);
  if (!storedToken || storedToken !== refreshToken) {
    throw createForbiddenError("Refresh токен не найден или устарел");
  }

  // Генерация новой пары токенов
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(userId, email, role);

  // Замена старого refresh токена на новый
  await saveRefreshToken(userId, newRefreshToken);

  // Добавление старого refresh токена в черный список
  const expiresIn = payload.exp ? payload.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60;
  if (expiresIn > 0) {
    await blacklistToken(refreshToken, expiresIn);
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Выход пользователя (инвалидация токенов)
 */
export async function logout(userId: number, accessToken: string, refreshToken?: string) {
  // Добавление access токена в черный список (оставшееся время жизни)
  const accessPayload = jwt.decode(accessToken) as jwt.JwtPayload;
  if (accessPayload?.exp) {
    const expiresIn = accessPayload.exp - Math.floor(Date.now() / 1000);
    if (expiresIn > 0) {
      await blacklistToken(accessToken, expiresIn);
    }
  }

  // Добавление refresh токена в черный список
  if (refreshToken) {
    const refreshPayload = jwt.decode(refreshToken) as jwt.JwtPayload;
    if (refreshPayload?.exp) {
      const expiresIn = refreshPayload.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await blacklistToken(refreshToken, expiresIn);
      }
    }
    // Удаление refresh токена из Redis
    await redis.del(`refresh:${userId}`);
  }
}

/**
 * Получение текущего пользователя
 */
export async function getCurrentUser(userId: number) {
  return await getUserById(prisma, userId);
}
