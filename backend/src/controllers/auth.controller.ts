import { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  // Схема валидации для регистрации
  private registerSchema = z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(6, 'Пароль должен содержать не менее 6 символов'),
    name: z.string().optional(),
  });

  // Схема валидации для входа
  private loginSchema = z.object({
    email: z.string().email('Некорректный email'),
    password: z.string().min(1, 'Пароль обязателен'),
  });

  // Регистрация
  async register(req: AuthRequest, res: Response) {
    try {
      const { email, password, name } = this.registerSchema.parse(req.body);
      const result = await this.authService.register(email, password, name);
      res.status(201).json({
        message: 'Пользователь успешно зарегистрирован',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка регистрации:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Вход
  async login(req: AuthRequest, res: Response) {
    try {
      const { email, password } = this.loginSchema.parse(req.body);
      const result = await this.authService.login(email, password);
      res.json({
        message: 'Вход выполнен успешно',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка входа:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Получение текущего пользователя
  async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      const user = await this.authService.getCurrentUser(req.user!.id);
      if (!user) {
        res.status(404).json({ error: 'Пользователь не найден' });
        return;
      }
      res.json({ user });
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
}
