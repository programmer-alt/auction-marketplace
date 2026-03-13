import { Response } from 'express';
import { z } from 'zod';
import { AuctionsService } from '../services/auctions.service';
import { AuthRequest } from '../middleware/auth';

export class AuctionsController {
  private auctionsService: AuctionsService;

  constructor() {
    this.auctionsService = new AuctionsService();
  }

  // Схема валидации для создания нового аукциона
  private createAuctionSchema = z.object({
    title: z.string().min(1, 'Название обязательно'),
    description: z.string().optional(),
    imageUrl: z.string().url('Некорректный URL изображения').optional().or(z.literal('')),
    startingPrice: z.number().positive('Начальная цена должна быть положительной'),
    currency: z.string().length(3, 'Валюта должна быть трёхбуквенным кодом (например, USD, RUB)').optional(),
    endsAt: z.string().datetime('Некорректная дата окончания'),
  });

  // Схема валидации для обновления аукциона
  private updateAuctionSchema = z.object({
    title: z.string().min(1, 'Название обязательно').optional(),
    description: z.string().optional(),
    imageUrl: z.string().url('Некорректный URL изображения').optional().or(z.literal('')).optional(),
    startingPrice: z.number().positive('Начальная цена должна быть положительной').optional(),
    currency: z.string().length(3, 'Валюта должна быть трёхбуквенным кодом (например, USD, RUB)').optional(),
    endsAt: z.string().datetime('Некорректная дата окончания').optional(),
  });

  // Получение списка аукционов
  async getAuctions(req: AuthRequest, res: Response) {
    try {
      const { status, sellerId, page = '1', limit = '20' } = req.query;
      const result = await this.auctionsService.getAuctions({
        status: status as string,
        sellerId: sellerId ? parseInt(sellerId as string, 10) : undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });
      res.json(result);
    } catch (error) {
      console.error('Ошибка получения списка аукционов:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Получение конкретного аукциона
  async getAuctionById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Некорректный ID аукциона' });
        return;
      }
      const result = await this.auctionsService.getAuctionById(id);
      if (!result) {
        res.status(404).json({ error: 'Аукцион не найден' });
        return;
      }
      res.json({ auction: result });
    } catch (error) {
      console.error('Ошибка получения аукциона:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Создание нового аукциона
  async createAuction(req: AuthRequest, res: Response) {
    try {
      const data = this.createAuctionSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await this.auctionsService.createAuction(data, userId);
      res.status(201).json({
        message: 'Аукцион успешно создан',
        auction: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка создания аукциона:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Обновление аукциона
  async updateAuction(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Некорректный ID аукциона' });
        return;
      }
      const data = this.updateAuctionSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await this.auctionsService.updateAuction(id, data, userId);
      res.json({
        message: 'Аукцион успешно обновлён',
        auction: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      console.error('Ошибка обновления аукциона:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }

  // Удаление аукциона
  async deleteAuction(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Некорректный ID аукциона' });
        return;
      }
      const userId = req.user!.id;
      await this.auctionsService.deleteAuction(id, userId);
      res.json({ message: 'Аукцион успешно удалён' });
    } catch (error) {
      console.error('Ошибка удаления аукциона:', error);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
}
