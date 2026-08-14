import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "@/controllers/auth.controller";
import { authMiddleware, optionalAuthMiddleware } from "@/middleware/auth";
import type { Request, Response } from 'express';

const router = Router();

// Rate limiter для защиты от Brute Force на регистрацию
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток регистрации с одного IP
  message: {
    error: "Слишком много попыток регистрации. Попробуйте через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для защиты от Brute Force на вход
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток входа с одного IP
  message: {
    error: "Слишком много попыток входа. Попробуйте через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Условное применение рейт-лимитов в зависимости от среды
const isProduction = process.env.NODE_ENV === 'production';

// Middleware для пропуска лимитов в разработке
const skipRateLimit = (_req: Request, _res: Response, next: (err?: Error) => void) => next();

// Добавляем новый рейт-лимитер для refresh
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // 20 попыток обновления токенов с одного IP
  message: {
    error: "Слишком много попыток обновления токенов. Попробуйте через 15 минут.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/register - Регистрация
router.post("/register", isProduction ? registerLimiter : skipRateLimit, authController.register);

// POST /api/auth/login - Вход
router.post("/login", isProduction ? loginLimiter : skipRateLimit, authController.login);

// POST /api/auth/refresh - Обновление токенов (с отдельным ограничителем)
router.post("/refresh", isProduction ? refreshLimiter : skipRateLimit, authController.refresh);

// POST /api/auth/logout - Выход
router.post("/logout", authMiddleware, authController.logout);

// GET /api/auth/me - Текущий пользователь (опциональная аутентификация)
router.get("/me", optionalAuthMiddleware, authController.getCurrentUser);

export default router;