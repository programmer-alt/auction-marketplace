import { z } from "zod";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { createNotFoundError } from "../errors/factories";

// ========================================
// Схемы валидации
// ========================================

const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Пароль должен содержать не менее 6 символов"),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Пароль обязателен"),
});

// ========================================
// Контроллер
// ========================================

export const authController = {
  register: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const result = await authService.register(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );
    res.status(201).json({
      message: "Пользователь успешно зарегистрирован",
      user: result.user,
      token: result.token,
    });
  }),

  login: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const result = await authService.login(parsed.data.email, parsed.data.password);
    res.json({
      message: "Вход выполнен успешно",
      user: result.user,
      token: result.token,
    });
  }),

  getCurrentUser: asyncHandler<AuthRequest>(async (req, res, next) => {
    const user = await authService.getCurrentUser(req.user!.id);
    if (!user) return next(createNotFoundError("Пользователь не найден"));
    res.json(user);
  }),
};
