import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const paymentsController = new PaymentsController();

// POST /api/payments/create-intent — создание Payment Intent
router.post('/create-intent', authMiddleware, paymentsController.createPaymentIntent.bind(paymentsController));

// POST /api/payments/webhook — обработка вебхука Stripe
router.post('/webhook', paymentsController.handleWebhook.bind(paymentsController));

// GET /api/payments/history — история платежей пользователя
router.get('/history', authMiddleware, paymentsController.getPaymentHistory.bind(paymentsController));

export default router;
