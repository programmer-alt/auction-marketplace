import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from "../config/jwt";
import { redis } from "../config/redis";

export interface AuthContext {
  id: number;
  email: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthContext;
}

export type AuthResult =
  | { success: true; user: AuthContext }
  | { success: false; error: string };

// Проверка, находится ли токен в черном списке
async function isTokenBlacklisted(token: string): Promise<boolean> {
  const key = `blacklist:${token}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

// Функциональная версия проверки токена
export async function parseAuthToken(token: string | undefined): Promise<AuthResult> {
  if (!token) {
    return { success: false, error: "No token provided" };
  }

  const cleanToken = token.replace("Bearer ", "");

  // Проверка черного списка
  if (await isTokenBlacklisted(cleanToken)) {
    return { success: false, error: "Token revoked" };
  }

  try {
    const decoded = jwt.verify(
      cleanToken,
      getJwtSecret(),
    ) as { id: number; email: string; role: string };

    return {
      success: true,
      user: { id: decoded.id, email: decoded.email, role: decoded.role ?? 'USER' },
    };
  } catch (error) {
    console.error("Auth error:", error);
    return { success: false, error: "Invalid token" };
  }
}

// Базовая функция проверки токена
async function checkAuthToken(authHeader: string | undefined): Promise<AuthResult> {
  return await parseAuthToken(authHeader);
}

// Обязательная аутентификация
export function createAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authResult = await checkAuthToken(req.headers.authorization);

    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    (req as AuthRequest).user = authResult.user;
    next();
  };
}

export const authMiddleware = createAuthMiddleware();

// Опциональная аутентификация
export function createOptionalAuthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    // Если токен отсутствует - просто продолжаем
    if (!authHeader) {
      return next();
    }

    const authResult = await checkAuthToken(authHeader);

    // Если токен есть, но невалиден - возвращаем 401
    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    (req as AuthRequest).user = authResult.user;
    next();
  };
}

export const optionalAuthMiddleware = createOptionalAuthMiddleware();
