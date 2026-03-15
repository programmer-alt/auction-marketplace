import { Router } from 'express';
import { paymentsController } from '../controllers/payments.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/payments/create-intent — создание Payment Intent
router.post('/create-intent', authMiddleware, paymentsController.createPaymentIntent);

// POST /api/payments/webhook — обработка вебхука Stripe
router.post('/webhook', paymentsController.handleWebhook);

// GET /api/payments/history — история платежей пользователя
router.get('/history', authMiddleware, paymentsController.getPaymentHistory);

export default router;
