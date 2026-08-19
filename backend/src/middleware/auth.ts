import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from "../config/jwt";

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

// Функциональная версия проверки токена
export async function parseAuthToken(token: string | undefined): Promise<AuthResult> {
  if (!token || token.trim() === "") {
    return { success: false, error: "No token provided" };
  }

  const cleanToken = token.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(
      cleanToken,
      getJwtSecret(),
    ) as { id: number; email: string; role: string };

    return {
      success: true,
      user: { id: decoded.id, email: decoded.email, role: decoded.role ?? "USER" },
    };
  } catch (error) {
    // Type guard для проверки, является ли ошибка экземпляром Error
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    // На случай, если будет брошен не-Error объект (что маловероятно, но возможно в JS)
    return { success: false, error: "Invalid token" };
  }
}

// Базовая функция проверки токена
async function checkAuthToken(authHeader: string | undefined): Promise<AuthResult> {
  return parseAuthToken(authHeader);
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
