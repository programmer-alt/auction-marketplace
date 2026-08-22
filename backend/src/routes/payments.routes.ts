import { Router } from "express";
import { paymentsController } from "../controllers/payments.controller";
import { adminMiddleware } from "../middleware/admin";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// POST /api/payments/create-intent — создание Payment Intent
router.post("/create-intent", authMiddleware, paymentsController.createPaymentIntent);

// POST /api/payments/webhook — обработка вебхука Stripe
router.post("/webhook", paymentsController.handleWebhook);

// GET /api/payments/my — история платежей пользователя
router.get("/my", authMiddleware, paymentsController.getPaymentHistory);

// POST /api/payments/:id/refund — возврат платежа (только для администраторов)
router.post("/:id/refund", authMiddleware, adminMiddleware, paymentsController.refundPayment);

export default router;
