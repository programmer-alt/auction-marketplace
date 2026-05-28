import { Request, Response } from "express";
import { z } from "zod";
import * as paymentsService from "../services/payments.service";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { createValidationError } from "../errors/factories";

// ========================================
// Схемы валидации
// ========================================

const createPaymentSchema = z.object({
  auctionId: z.number().int().positive("ID аукциона должен быть положительным"),
});

const refundPaymentSchema = z.object({
  paymentId: z.number().int().positive("ID платежа должен быть положительным"),
  reason: z.string().max(500, "Причина возврата слишком длинная").optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, "Page >= 1").default(1),
  limit: z.coerce.number().int().min(1, "Limit >= 1").max(100, "Limit <= 100").default(20),
});

// ========================================
// Контроллер
// ========================================

export const paymentsController = {
  createPaymentIntent: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    if (!req.user) {
      return next(createValidationError("Пользователь не аутентифицирован"));
    }

    const result = await paymentsService.createPaymentIntent(
      parsed.data.auctionId,
      req.user.id,
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

      if (!sig) {
        res.status(400).send("Missing stripe-signature header");
        return;
      }

      await paymentsService.handleWebhook(req.body, sig);
      res.json({ received: true });
    } catch (error) {
      console.error("[webhook] Error processing webhook:", error);
      res.status(400).send("Webhook processing failed");
    }
  },

  getPaymentHistory: asyncHandler<AuthRequest>(async (req, res, next) => {
    if (!req.user) {
      return next(createValidationError("Пользователь не аутентифицирован"));
    }

    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);

    const result = await paymentsService.getPaymentHistory(req.user.id, {
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
    res.json(result);
  }),

  refundPayment: asyncHandler<AuthRequest>(async (req, res, next) => {
    const parsed = refundPaymentSchema.safeParse(req.body);
    if (!parsed.success) return next(parsed.error);

    if (!req.user) {
      return next(createValidationError("Пользователь не аутентифицирован"));
    }

    const result = await paymentsService.refundPayment(
      parsed.data.paymentId,
      req.user.id,
      parsed.data.reason,
    );
    res.json({
      message: "Возврат успешно создан",
      refundId: result.refundId,
      payment: result.payment,
    });
  }),
};
