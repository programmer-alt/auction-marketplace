import { z } from "zod";
import { createValidationError } from "../errors/factories";
import type { AuthRequest } from "../middleware/auth";
import * as bidsService from "../services/bids.service";
import { asyncHandler } from "../utils/asyncHandler";

// ========================================
// Схемы валидации
// ========================================

const createBidSchema = z.object({
  amount: z.number().positive("Сумма ставки должна быть положительной"),
});

// ========================================
// Контроллер
// ========================================

export const bidsController = {
  createBid: asyncHandler<AuthRequest>(async (req, res, next) => {
    const auctionId = Number.parseInt(req.params.auctionId, 10);
    if (Number.isNaN(auctionId)) return next(createValidationError("Некорректный ID аукциона"));

    const parsed = createBidSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    if (!req.user) {
      return next(createValidationError("Пользователь не аутентифицирован"));
    }

    const result = await bidsService.createBid(auctionId, req.user.id, parsed.data.amount);
    res.status(201).json({
      message: "Ставка успешно размещена",
      bid: result.bid,
      auction: result.auction,
    });
  }),

  getBidsByAuction: asyncHandler<AuthRequest>(async (req, res, next) => {
    const auctionId = Number.parseInt(req.params.auctionId, 10);
    if (Number.isNaN(auctionId)) return next(createValidationError("Некорректный ID аукциона"));

    const { page = "1", limit = "50" } = req.query;
    const result = await bidsService.getBidsByAuction(auctionId, {
      page: Number.parseInt(page as string, 10),
      limit: Number.parseInt(limit as string, 10),
    });
    res.json(result);
  }),
};
