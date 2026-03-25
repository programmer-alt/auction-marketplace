import Stripe from "stripe";
import { prisma } from "../index";
import {
  createPayment,
  getPaymentByStripeId,
  updatePayment,
  getPaymentsByUserId,
  getPaymentsCountByUserId,
} from "../repositories/payments.repository";
import { PaymentWithRelations, PaymentWithAuctionSeller } from "../types";
import { NotFoundError, ValidationError, ForbiddenError } from "../errors";

// ========================================
// Инициализация Stripe
// ========================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

// ========================================
// Типы
// ========================================

export interface GetPaymentHistoryOptions {
  page: number;
  limit: number;
}

export interface CreatePaymentIntentResult {
  clientSecret: string | null;
  payment: PaymentWithRelations;
}

export interface GetPaymentHistoryResult {
  payments: PaymentWithAuctionSeller[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
}

/**
 * Создание Payment Intent
 */
export async function createPaymentIntent(
  auctionId: number,
  userId: number,
): Promise<CreatePaymentIntentResult> {
  // Проверяем аукцион
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      winner: true,
      seller: true,
    },
  });

  if (!auction) {
    throw new NotFoundError("Аукцион не найден");
  }

  // Проверяем, что аукцион завершён и пользователь — победитель
  if (auction.status !== "COMPLETED") {
    throw new ValidationError("Аукцион ещё не завершён");
  }

  if (auction.winnerId !== userId) {
    throw new ForbiddenError("Вы не являетесь победителем этого аукциона");
  }

  // Проверяем, не оплачен ли уже этот аукцион
  const existingPayment = await prisma.payment.findFirst({
    where: {
      auctionId,
      userId,
      status: "COMPLETED",
    },
  });

  if (existingPayment) {
    throw new ValidationError("Этот аукцион уже оплачен");
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
  const payment = await createPayment(prisma, {
    userId,
    auctionId,
    amount: auction.currentPrice,
    currency,
    stripePaymentId: paymentIntent.id,
    status: "PENDING",
  });

  return {
    clientSecret: paymentIntent.client_secret,
    payment,
  };
}

/**
 * Обработка вебхука Stripe
 */
export async function handleWebhook(body: Buffer | string, sig: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);

  // Обрабатываем события
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const stripePaymentId = paymentIntent.id;

      // Находим платеж по stripePaymentId
      const payment = await getPaymentByStripeId(prisma, stripePaymentId);

      if (payment) {
        await updatePayment(prisma, payment.id, { status: "COMPLETED" });
        console.log(`Платёж ${stripePaymentId} успешно завершён`);
      } else {
        console.warn(
          `Платёж с stripePaymentId ${stripePaymentId} не найден в БД`,
        );
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const stripePaymentId = paymentIntent.id;

      const payment = await getPaymentByStripeId(prisma, stripePaymentId);

      if (payment) {
        await updatePayment(prisma, payment.id, { status: "FAILED" });
        console.log(`Платёж ${stripePaymentId} не удался`);
      } else {
        console.warn(
          `Платёж с stripePaymentId ${stripePaymentId} не найден в БД`,
        );
      }
      break;
    }

    default:
      console.log(`Необработанное событие типа ${event.type}`);
  }
}

/**
 * Получение истории платежей пользователя
 */
export async function getPaymentHistory(
  userId: number,
  options: GetPaymentHistoryOptions,
): Promise<GetPaymentHistoryResult> {
  const { page, limit } = options;
  
  // Валидация параметров пагинации
  if (limit <= 0 || !Number.isInteger(limit)) {
    throw new ValidationError("Limit must be a positive integer");
  }
  if (page < 1 || !Number.isInteger(page)) {
    throw new ValidationError("Page must be a positive integer");
  }
  
  const skip = (page - 1) * limit;

  const payments = await getPaymentsByUserId(prisma, userId, skip, limit);

  const total = await getPaymentsCountByUserId(prisma, userId);

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