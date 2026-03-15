import { Response } from "express";
import { z } from "zod";
import * as auctionsService from "../services/auctions.service";
import { AuthRequest } from "../middleware/auth";

// ========================================
// Схемы валидации
// ========================================

const createAuctionSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  imageUrl: z
    .string()
    .url("Некорректный URL изображения")
    .optional()
    .or(z.literal("")),
  startingPrice: z
    .number()
    .positive("Начальная цена должна быть положительной"),
  currency: z
    .string()
    .length(3, "Валюта должна быть трёхбуквенным кодом (например, USD, RUB)")
    .optional(),
  endsAt: z.string().datetime("Некорректная дата окончания"),
});

const updateAuctionSchema = z.object({
  title: z.string().min(1, "Название обязательно").optional(),
  description: z.string().optional(),
  imageUrl: z
    .string()
    .url("Некорректный URL изображения")
    .optional()
    .or(z.literal(""))
    .optional(),
  startingPrice: z
    .number()
    .positive("Начальная цена должна быть положительной")
    .optional(),
  currency: z
    .string()
    .length(3, "Валюта должна быть трёхбуквенным кодом (например, USD, RUB)")
    .optional(),
  endsAt: z.string().datetime("Некорректная дата окончания").optional(),
});

// ========================================
// Контроллер (объект с функциями)
// ========================================

export const auctionsController = {
  // Получение списка аукционов
  async getAuctions(req: AuthRequest, res: Response) {
    try {
      const { status, sellerId, page = "1", limit = "20" } = req.query;
      const result = await auctionsService.getAuctions({
        status: status as string,
        sellerId: sellerId ? parseInt(sellerId as string, 10) : undefined,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });
      res.json(result);
    } catch (error) {
      console.error("Ошибка получения списка аукционов:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  },

  // Получение конкретного аукциона
  async getAuctionById(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Некорректный ID аукциона" });
        return;
      }
      const result = await auctionsService.getAuctionById(id);
      if (!result) {
        res.status(404).json({ error: "Аукцион не найден" });
        return;
      }
      res.json({ auction: result });
    } catch (error) {
      console.error("Ошибка получения аукциона:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  },

  // Создание нового аукциона
  async createAuction(req: AuthRequest, res: Response) {
    try {
      const data = createAuctionSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await auctionsService.createAuction(data, userId);
      res.status(201).json({
        message: "Аукцион успешно создан",
        auction: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof Error) {
        // Обработка ошибок из сервиса
        if (error.message.includes("Дата окончания")) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      console.error("Ошибка создания аукциона:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  },

  // Обновление аукциона
  async updateAuction(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Некорректный ID аукциона" });
        return;
      }
      const data = updateAuctionSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await auctionsService.updateAuction(id, data, userId);
      res.json({
        message: "Аукцион успешно обновлён",
        auction: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      if (error instanceof Error) {
        // Обработка ошибок из сервиса
        if (error.message.includes("Аукцион не найден")) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes("Недостаточно прав")) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error.message.includes("Дата окончания")) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (error.message.includes("активные аукционы")) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      console.error("Ошибка обновления аукциона:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  },

  // Удаление аукциона
  async deleteAuction(req: AuthRequest, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Некорректный ID аукциона" });
        return;
      }
      const userId = req.user!.id;
      await auctionsService.deleteAuction(id, userId);
      res.json({ message: "Аукцион успешно удалён" });
    } catch (error) {
      if (error instanceof Error) {
        // Обработка ошибок из сервиса
        if (error.message.includes("Аукцион не найден")) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes("Недостаточно прав")) {
          res.status(403).json({ error: error.message });
          return;
        }
      }
      console.error("Ошибка удаления аукциона:", error);
      res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
  },
};
