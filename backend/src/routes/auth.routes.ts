import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

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

// POST /api/auth/register - Регистрация
router.post("/register", registerLimiter, authController.register);

// POST /api/auth/login - Вход
router.post("/login", loginLimiter, authController.login);

// POST /api/auth/refresh - Обновление токенов
router.post("/refresh", authController.refresh);

// POST /api/auth/logout - Выход
router.post("/logout", authMiddleware, authController.logout);

// GET /api/auth/me - Текущий пользователь
router.get("/me", authMiddleware, authController.getCurrentUser);

export default router;
