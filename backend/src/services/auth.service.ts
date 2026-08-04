import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { Prisma } from "../types";
import { prisma } from "../config/db";
import { safeRedis } from "../config/redis";
import logger from "../config/logger";
import {
  getUserByEmail,
  createUser,
  getUserById,
} from "../repositories/users.repository";
import { createValidationError, createForbiddenError } from "../errors/factories";

import { getJwtSecret, getJwtAccessExpiresIn, getJwtRefreshExpiresIn, parseDurationToSeconds, maskEmail } from "../config/jwt";

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

  // По умолчанию access-токен живет заметно меньше, чем refresh-токен.
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
 * Сохранение refresh токена в Redis
 */
async function saveRefreshToken(userId: number, refreshToken: string) {
  const key = `refresh:${userId}`;

  // выравниваем TTL в Redis с конфигурацией JWT refresh токена
  const refreshExpiresIn = getJwtRefreshExpiresIn();
  const ttl = parseDurationToSeconds(refreshExpiresIn);

  await safeRedis.setex(key, ttl, refreshToken);

  // Диагностика: проверим, что ключ реально записался
  try {
    const stored = await safeRedis.get(key);
    logger.info('[REFRESH_TOKEN_SAVE]', {
      key,
      stored: stored ? 'yes' : 'no',
      ttl,
      refreshExpiresIn,
    });
  } catch (e) {
    logger.warn('[REFRESH_TOKEN_SAVE] failed to verify stored token in redis:', e);
  }
}


/**
 * Проверка, находится ли токен в черном списке
 */
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `blacklist:${token}`;
  const exists = await safeRedis.get(key);
  return exists === "1";
}

/**
 * Добавление токена в черный список
 */
async function blacklistToken(token: string, expiresInSeconds: number) {
  const key = `blacklist:${token}`;
  await safeRedis.setex(key, expiresInSeconds, '1');
}

/**
 * Регистрация пользователя
 */
export async function register(email: string, password: string, name?: string) {
  const maskedEmail = maskEmail(email);
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
  await saveRefreshToken(user.id, refreshToken);

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
  await saveRefreshToken(user.id, refreshToken);

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
  const {email, role} = payload;

  // Проверка, что refresh токен сохранен в Redis
  const key = `refresh:${userId}`;
  const storedToken = await safeRedis.get(key);

  const safeTail = (t: string | null | undefined) => {
    if (!t) return 'null';
    const head = t.slice(0, 6);
    const tail = t.slice(-6);
    return `${head}...${tail}(len=${t.length})`;
  };

  logger.info(
    `[REFRESH_TOKEN_CHECK] key=${key} stored=${storedToken ? 'yes' : 'no'} ` +
    `stored=${safeTail(storedToken)} refresh=${safeTail(refreshToken)}`
  );

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
    await safeRedis.del(`refresh:${userId}`);
  }
}

/**
 * Получение текущего пользователя
 */
export async function getCurrentUser(userId: number) {
  return await getUserById(prisma, userId);
}