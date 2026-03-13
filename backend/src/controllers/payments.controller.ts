import { Response } from 'express';
import { z } from 'zod';
import * as paymentsService from '../services/payments.service';
import { AuthRequest } from '../middleware/auth.middleware';

// ========================================
// Схемы валидации
// ========================================

const createPaymentSchema = z.object({
  auctionId: z.number().int().positive('ID аукциона должен быть положительным'),
});

// ========================================
// Контроллер (объект с функциями)
// ========================================

export const paymentsController = {
  // Создание Payment Intent
  async createPaymentIntent(req: AuthRequest, res: Response) {
    try {
      const { auctionId } = createPaymentSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await paymentsService.createPaymentIntent(auctionId, userId);
      res.status(201).json({
        message: 'Платёжный интент создан',
        clientSecret: result.clientSecret,
        payment: result.payment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка создания платежного интента:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  },

  // Обработка вебхука Stripe
  async handleWebhook(req: AuthRequest, res: Response) {
    try {
      const sig = req.headers['stripe-signature'] as string;
      await paymentsService.handleWebhook(req.body, sig);
      res.json({ received: true });
    } catch (error: any) {
      console.error('Ошибка обработки вебхука:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  },

  // Получение истории платежей пользователя
  async getPaymentHistory(req: AuthRequest, res: Response) {
    try {
      const { page = '1', limit = '20' } = req.query;
      const userId = req.user!.id;
      const result = await paymentsService.getPaymentHistory(userId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });
      res.json(result);
    } catch (error) {
      console.error('Ошибка получения истории платежей:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  },
};
