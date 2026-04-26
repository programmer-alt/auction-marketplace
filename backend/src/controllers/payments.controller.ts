import { Request, Response } from "express";
import { z } from "zod";
import * as paymentsService from "../services/payments.service";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

// ========================================
// Схемы валидации
// ========================================

const createPaymentSchema = z.object({
  auctionId: z.number().int().positive("ID аукциона должен быть положительным"),
});

// ========================================
// Контроллер
// ========================================

export const paymentsController = {
  createPaymentIntent: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    const result = await paymentsService.createPaymentIntent(
      parsed.data.auctionId,
      req.user!.id,
    );
    res.status(201).json({
      message: "Платёжный интент создан",
      clientSecret: result.clientSecret,
      payment: result.payment,
    });
  }),

  // Webhook намеренно не использует asyncHandler:
  // Stripe ожидает text/plain ответ при ошибке, не JSON
  async handleWebhook(req: Request, res: Response) {
    try {
      const sig = req.headers["stripe-signature"] as string;
      await paymentsService.handleWebhook(req.body, sig);
      res.json({ received: true });
    } catch (error) {
      console.error("[webhook] Error processing webhook:", error);
      res.status(400).send("Webhook processing failed");
    }
  },

  getPaymentHistory: asyncHandler<AuthRequest>(async (req, res) => {
    const { page = "1", limit = "20" } = req.query;
    const result = await paymentsService.getPaymentHistory(req.user!.id, {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    });
    res.json(result);
  }),
};
