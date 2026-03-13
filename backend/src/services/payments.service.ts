import Stripe from 'stripe';
import { prisma } from '../index';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

interface GetPaymentHistoryOptions {
  page: number;
  limit: number;
}

export class PaymentsService {
  // Создание Payment Intent
  async createPaymentIntent(auctionId: number, userId: number) {
    // Проверяем аукцион
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        winner: true,
        seller: true,
      },
    });

    if (!auction) {
      throw new Error('Аукцион не найден');
    }

    // Проверяем, что аукцион завершён и пользователь — победитель
    if (auction.status !== 'COMPLETED') {
      throw new Error('Аукцион ещё не завершён');
    }

    if (auction.winnerId !== userId) {
      throw new Error('Вы не являетесь победителем этого аукциона');
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
      throw new Error('Этот аукцион уже оплачен');
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

    return {
      clientSecret: paymentIntent.client_secret,
      payment,
    };
  }

  // Обработка вебхука Stripe
  async handleWebhook(body: any, sig: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

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
  }

  // Получение истории платежей пользователя
  async getPaymentHistory(userId: number, options: GetPaymentHistoryOptions) {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const payments = await prisma.payment.findMany({
      where: { userId },
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
      take: limit,
    });

    const total = await prisma.payment.count({ where: { userId } });

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
