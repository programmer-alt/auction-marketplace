import { z } from "zod";
import * as auctionsService from "../services/auctions.service";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { createValidationError, createNotFoundError } from "../errors/factories";

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
// Контроллер
// ========================================

export const auctionsController = {
  getAuctions: asyncHandler<AuthRequest>(async (req, res) => {
    const { status, sellerId, page = "1", limit = "20" } = req.query;
    const result = await auctionsService.getAuctions({
      status: status as string,
      sellerId: sellerId ? parseInt(sellerId as string, 10) : undefined,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });
    res.json(result);
  }),

  getAuctionById: asyncHandler<AuthRequest>(async (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(createValidationError("Некорректный ID аукциона"));

    const result = await auctionsService.getAuctionById(id);
    if (!result) return next(createNotFoundError("Аукцион не найден"));

    res.json({ auction: result });
  }),

  createAuction: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = createAuctionSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const userId = req.user?.id;
    if (!userId) return next(createValidationError("User not authenticated"));
    
    const result = await auctionsService.createAuction(parsed.data, userId);
    res.status(201).json({ message: "Аукцион успешно создан", auction: result });
  }),

  updateAuction: asyncHandler<AuthRequest>(async (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(createValidationError("Некорректный ID аукциона"));

    const parsed = updateAuctionSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const userId = req.user?.id;
    if (!userId) return next(createValidationError("User not authenticated"));
    
    const result = await auctionsService.updateAuction(id, parsed.data, userId);
    res.json({ message: "Аукцион успешно обновлён", auction: result });
  }),

  deleteAuction: asyncHandler<AuthRequest>(async (req, res, next) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return next(createValidationError("Некорректный ID аукциона"));

    const userId = req.user?.id;
    if (!userId) return next(createValidationError("User not authenticated"));
    
    await auctionsService.deleteAuction(id, userId);
    res.json({ message: "Аукцион успешно удалён" });
  }),
};
