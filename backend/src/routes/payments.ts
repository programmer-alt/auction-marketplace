import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../index.js';
import { type AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Схема для создания платежа
const createPaymentSchema = z.object({
  auctionId: z.number().int().positive('ID аукциона должен быть положительным'),
});

// POST /api/payments/create-intent — создание Payment Intent
router.post('/create-intent', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { auctionId } = createPaymentSchema.parse(req.body);
    const userId = req.user!.id;

    // Проверяем аукцион
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        winner: true,
        seller: true,
      },
    });

    if (!auction) {
      res.status(404).json({ error: 'Аукцион не найден' });
      return;
    }

    // Проверяем, что аукцион завершён и пользователь — победитель
    if (auction.status !== 'COMPLETED') {
      res.status(400).json({ error: 'Аукцион ещё не завершён' });
      return;
    }

    if (auction.winnerId !== userId) {
      res.status(403).json({ error: 'Вы не являетесь победителем этого аукциона' });
      return;
    }

    // Проверяем, не оплачен ли уже этот аукцион
    const existingPayment = await prisma.payment.findFirst({
      where: {
        auctionId,
        userId,
        status: 'COMPLETED',
      },
    });

    if (existingPayment) {
      res.status(400).json({ error: 'Этот аукцион уже оплачен' });
      return;
    }

    // Сумма к оплате (текущая цена аукциона)
    const amount = Math.round(auction.currentPrice.toNumber() * 100); // в копейках/центах
    const currency = auction.currency.toLowerCase(); // гарантируем нижний регистр

    // Создаём Payment Intent в Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        auctionId: auction.id.toString(),
        userId: userId.toString(),
        winnerEmail: req.user!.email,
      },
      description: `Оплата аукциона: ${auction.title}`,
    });

    // Создаём запись о платеже в БД
    const payment = await prisma.payment.create({
      data: {
        userId,
        auctionId,
        amount: auction.currentPrice,
        currency,
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
        auction: {
          select: { id: true, title: true, currentPrice: true, currency: true },
        },
      },
    });

    res.status(201).json({
      message: 'Платёжный интент создан',
      clientSecret: paymentIntent.client_secret,
      payment,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
      return;
    }
    console.error('Ошибка создания платежного интента:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/payments/webhook — обработка вебхука Stripe
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Ошибка верификации вебхука:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Обрабатываем события
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const stripePaymentId = paymentIntent.id;

      // Находим платеж по stripePaymentId
      const payment = await prisma.payment.findFirst({
        where: { stripePaymentId },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'COMPLETED' },
        });
        console.log(`Платёж ${stripePaymentId} успешно завершён`);
      } else {
        console.warn(`Платёж с stripePaymentId ${stripePaymentId} не найден в БД`);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const stripePaymentId = paymentIntent.id;

      const payment = await prisma.payment.findFirst({
        where: { stripePaymentId },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });
        console.log(`Платёж ${stripePaymentId} не удался`);
      } else {
        console.warn(`Платёж с stripePaymentId ${stripePaymentId} не найден в БД`);
      }
      break;
    }

    default:
      console.log(`Необработанное событие типа ${event.type}`);
  }

  res.json({ received: true });
});

// GET /api/payments/history — история платежей пользователя
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const parsedPage = parseInt(page as string, 10);
    const parsedLimit = parseInt(limit as string, 10);

    // Validate and normalize pagination params: ensure positive integers and sensible defaults
    const pageNum = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limitNum = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20;

    // Cap the maximum limit to prevent unbounded client-controlled queries
    const MAX_LIMIT = 100;
    const cappedLimit = Math.min(limitNum, MAX_LIMIT);

    const skip = (pageNum - 1) * cappedLimit;

    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            seller: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: cappedLimit,
    });

    const total = await prisma.payment.count({ where: { userId: req.user!.id } });

    res.json({
      payments,
      pagination: {
        page: pageNum,
        limit: cappedLimit,
        total,
        totalPages: cappedLimit > 0 ? Math.ceil(total / cappedLimit) : 0,
      },
    });
  } catch (error) {
    console.error('Ошибка получения истории платежей:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;