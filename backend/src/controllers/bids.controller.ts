import { Response } from 'express';
import { z } from 'zod';
import * as bidsService from '../services/bids.service';
import { AuthRequest } from '../middleware/auth';

// ========================================
// Схемы валидации
// ========================================

const createBidSchema = z.object({
  amount: z.number().positive('Сумма ставки должна быть положительной'),
});

// ========================================
// Контроллер (объект с функциями)
// ========================================

export const bidsController = {
  // Создание ставки
  async createBid(req: AuthRequest, res: Response) {
    try {
      const auctionId = parseInt(req.params.auctionId, 10);
      if (isNaN(auctionId)) {
        res.status(400).json({ error: 'Некорректный ID аукциона' });
        return;
      }

      const { amount } = createBidSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await bidsService.createBid(auctionId, userId, amount);
      res.status(201).json({
        message: 'Ставка успешно размещена',
        bid: result.bid,
        auction: result.auction,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка размещения ставки:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  },

  // Получение истории ставок по аукциону
  async getBidsByAuction(req: AuthRequest, res: Response) {
    try {
      const auctionId = parseInt(req.params.auctionId, 10);
      if (isNaN(auctionId)) {
        res.status(400).json({ error: 'Некорректный ID аукциона' });
        return;
      }

      const { page = '1', limit = '50' } = req.query;
      const result = await bidsService.getBidsByAuction(auctionId, {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });
      res.json(result);
    } catch (error) {
      console.error('Ошибка получения истории ставок:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  },
};
