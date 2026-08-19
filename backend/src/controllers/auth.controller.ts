import { z } from "zod";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { createNotFoundError, createValidationError } from "../errors/factories";

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
    // Устанавливаем refresh токен в HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      sameSite: 'strict',
    });
    res.status(201).json({
      message: "Пользователь успешно зарегистрирован",
      user: result.user,
      token: result.accessToken,
    });
  }),

  login: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const result = await authService.login(parsed.data.email, parsed.data.password);
    // Устанавливаем refresh токен в HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      sameSite: 'strict',
    });
    res.json({
      message: "Вход выполнен успешно",
      user: result.user,
      token: result.accessToken,
    });
  }),

  // POST /api/auth/refresh — обновление access токена с помощью refresh токена из cookie
  refresh: asyncHandler<AuthRequest>(async (req, res, next) => {
    // Извлекаем refresh токен из cookie, а не из body, как указано в архитектуре
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      return next(createValidationError("Refresh токен обязателен"));
    }
    
    const result = await authService.refresh(refreshToken);
    // Обновляем refresh токен в cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      sameSite: "strict",
    });

    // Возвращаем только accessToken
    res.json({ accessToken: result.accessToken });
  }), 

  logout: asyncHandler<AuthRequest>(async (req, res, next) => {
    // Извлекаем access токен из заголовка
    const accessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!accessToken) {
      return next(createValidationError("Access токен отсутствует"));
    }
    if (!req.user) {
      return next(createValidationError("Пользователь не аутентифицирован"));
    }
    await authService.logout();
    // Удаляем refresh токен из cookie
    res.clearCookie('refreshToken');
    res.json({ message: "Выход выполнен успешно" });
  }),

  getCurrentUser: asyncHandler<AuthRequest>(async (req, res, next) => {
    if (!req.user) {
      return res.status(200).json({ user: null });
    }

    const user = await authService.getCurrentUser(req.user.id);
    if (!user) return next(createNotFoundError("Пользователь не найден"));

    return res.status(200).json({ user });
  }),
};
