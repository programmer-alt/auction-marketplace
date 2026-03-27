import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from "../config/jwt";

export interface AuthContext {
  id: number;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthContext;
}

export type AuthResult =
  | { success: true; user: AuthContext }
  | { success: false; error: string };

// Функциональная версия проверки токена
export function parseAuthToken(token: string | undefined): AuthResult {
  if (!token) {
    return { success: false, error: "No token provided" };
  }

  try {
    const decoded = jwt.verify(
      token.replace("Bearer ", ""),
      getJwtSecret(),
    ) as { id: number; email: string };

    return {
      success: true,
      user: { id: decoded.id, email: decoded.email },
    };
  } catch (error) {
    console.error("Auth error:", error);
    return { success: false, error: "Invalid token" };
  }
}

// Базовая функция проверки токена
function checkAuthToken(authHeader: string | undefined): AuthResult {
  return parseAuthToken(authHeader);
}

// Обязательная аутентификация
export function createAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authResult = checkAuthToken(req.headers.authorization);

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
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    // Если токен отсутствует - просто продолжаем
    if (!authHeader) {
      return next();
    }

    const authResult = checkAuthToken(authHeader);

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
