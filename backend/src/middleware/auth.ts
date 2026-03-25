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

// Функциональный middleware-адаптер для Express
export function createAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const authResult = parseAuthToken(authHeader);

    if (!authResult.success) {
      res.status(401).json({ error: authResult.error });
      return;
    }

    (req as AuthRequest).user = authResult.user;
    next();
  };
}

export const authMiddleware = createAuthMiddleware();
