import { type PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../config/db";
import {
  createPayment,
  getPaymentByStripeId,
  updateAuctionPaidAt,
  updatePayment,
} from "../repositories/payments.repository";
import { getAuctionById } from "../repositories/auctions.repository";
import { getUserById } from "../repositories/users.repository";
// Импортируем типы, включая Payment
import type {
  Payment,
  PaymentWithAuctionSeller,
  PaymentWithRelations,
} from "../types/index";
// Импортируем функции ошибок
import {
  createValidationError,
  createNotFoundError,
} from "../errors/factories";
// Импортируем остальные функции репозитория
import {
  getPaymentsByUserId,
  getPaymentsCountByUserId,
  getPaymentByIdWithAuction,
} from "../repositories/payments.repository";
// Импортируем глобальный экземпляр stripe
import { stripe } from "../config/stripe";

// ========================================
// Типы
// ========================================

// Определяем интерфейсы, как они были найдены в результатах поиска
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

export interface RefundPaymentResult {
  refundId: string;
  payment: PaymentWithRelations;
}

export async function createPaymentIntent(
  auctionId: number,
  userId: number,
  countryCode: string,
): Promise<CreatePaymentIntentResult> {
  const auction = await getAuctionById(prisma, auctionId);
  if (!auction) {
    throw new Error("Аукцион не найден");
  }

  if (auction.sellerId === userId) {
    throw new Error("Нельзя оплатить свой собственный аукцион");
  }

  const user = await getUserById(prisma, userId);
  if (!user) {
    throw new Error("Пользователь не найден");
  }

  // Предположим, что у аукциона есть базовая валюта, но мы можем изменить её в зависимости от страны
  // или использовать countryCode для других целей в Stripe
  const currency = auction.currency?.toLowerCase() || "usd"; // Базовая валюта из аукциона или USD по умолчанию

  // Создаем PaymentIntent через Stripe
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Number(auction.currentPrice) * 100, // Цена в центах
    currency: currency,
    description: `Оплата аукциона: ${auction.title}`, // Добавляем описание
    automatic_payment_methods: {
      enabled: true,
    },
    metadata: {
      auctionId: auction.id.toString(),
      userId: user.id.toString(),
      countryCode, // Добавляем countryCode в метаданные
    },
  });

  // Сохраняем информацию о платеже в нашей БД
  const payment = await createPayment(prisma, {
    userId: user.id,
    auctionId: auction.id,
    amount: auction.currentPrice,
    currency: currency.toUpperCase(), // Сохраняем валюту в верхнем регистре
    stripePaymentId: paymentIntent.id,
    status: "PENDING",
  });

  return {
    clientSecret: paymentIntent.client_secret,
    payment,
  };
}

// ========================================
// Обработка вебхука Stripe
// ========================================

/**
 * Общее событие для платежей с PaymentIntent — находит платёж и обновляет статус
 */
async function handlePaymentIntentEvent(
  prisma: PrismaClient,
  stripePaymentId: string,
  paymentStatus: "COMPLETED" | "FAILED",
  logMessage: string,
  paymentIntent?: Stripe.PaymentIntent,
  extraCheck?: (
    payment: Payment,
    paymentIntent: Stripe.PaymentIntent,
  ) => Promise<void>,
): Promise<void> {
  const payment = await getPaymentByStripeId(prisma, stripePaymentId);

  if (payment) {
    if (extraCheck && paymentIntent) {
      await extraCheck(payment, paymentIntent);
    }
    await updatePayment(prisma, payment.id, { status: paymentStatus });
    console.log(logMessage);
  } else {
    console.warn(
      `[ALERT] Платёж с stripePaymentId ${stripePaymentId} не найден в БД`,
    );
  }
}

/**
 * Обработка события payment_intent.succeeded
 * Вызывается после manual capture (списания) или automatic capture
 */
async function handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const stripePaymentId = paymentIntent.id;

  const payment = await getPaymentByStripeId(prisma, stripePaymentId);

  if (payment) {
    // Defense in depth: проверяем, что сумма PI совпадает с суммой в БД
    const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw", "vnd"]);
    const expectedAmount = ZERO_DECIMAL_CURRENCIES.has(
      payment.currency.toLowerCase(),
    )
      ? Math.round(payment.amount.toNumber())
      : Math.round(payment.amount.toNumber() * 100);
    if (paymentIntent.amount !== expectedAmount) {
      console.error(
        `[SECURITY] Сумма PaymentIntent (${paymentIntent.amount}) не совпадает с суммой в БД (${expectedAmount}). ` +
          `stripePaymentId=${stripePaymentId}, paymentId=${payment.id}`,
      );
      await updatePayment(prisma, payment.id, { status: "FAILED" });
      return;
    }

    // При manual capture — статус меняется на COMPLETED
    await updatePayment(prisma, payment.id, { status: "COMPLETED" });
    await updateAuctionPaidAt(prisma, payment.auctionId);
    console.log(
      `[CAPTURE] Платёж ${stripePaymentId} успешно списан, paymentId=${payment.id}`,
    );
  } else {
    console.warn(
      `[ALERT] Платёж с stripePaymentId ${stripePaymentId} не найден в БД — пользователь мог оплатить, но система не записала платёж`,
    );
  }
}

/**
 * Обработка событий payment_intent.payment_failed и payment_intent.canceled
 */
async function handlePaymentStateChangeEvent(
  event: Stripe.Event,
  paymentStatus: "FAILED",
  logMessagePrefix: string,
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const fullLogMessage = `${logMessagePrefix} ${paymentIntent.id}`;
  await handlePaymentIntentEvent(
    prisma,
    paymentIntent.id,
    paymentStatus,
    fullLogMessage,
    paymentIntent,
  );
}

/**
 * Обработка события charge.refunded
 */
async function handleRefund(event: Stripe.Event): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const stripePaymentId = charge.payment_intent as string;

  if (stripePaymentId) {
    const payment = await getPaymentByStripeId(prisma, stripePaymentId);
    if (payment) {
      await updatePayment(prisma, payment.id, { status: "REFUNDED" });
      console.log(`Возврат для платежа ${stripePaymentId} обработан`);
    } else {
      console.error(
        `[ALERT] Платёж с stripePaymentId ${stripePaymentId} не найден в БД при обработке возврата`,
      );
    }
  }
}

export async function handleWebhook(body: Buffer | string, sig: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[FATAL] STRIPE_WEBHOOK_SECRET is not configured");
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      console.error(`[SECURITY] Invalid webhook signature: ${error.message}`);
      throw createValidationError("Invalid webhook signature");
    }
    throw error;
  }

  // Делегируем обработку событий специализированным функциям
  const eventType = event.type as string;
  switch (eventType) {
    case "payment_intent.succeeded":
      await handlePaymentSucceeded(event);
      break;

    case "payment_intent.payment_failed":
      await handlePaymentStateChangeEvent(event, "FAILED", "Платёж не удался");
      break;

    case "payment_intent.canceled":
      await handlePaymentStateChangeEvent(event, "FAILED", "Платёж отменён");
      break;

    case "payment_intent.requires_capture":
      // PaymentIntent готов к manual capture — статус AUTHORIZED
      {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const payment = await getPaymentByStripeId(prisma, paymentIntent.id);
        if (payment) {
          await updatePayment(prisma, payment.id, { status: "AUTHORIZED" });
          console.log(
            `[AUTH] PaymentIntent готов к capture, paymentId=${payment.id}`,
          );
        }
      }
      break;

    case "charge.refunded":
      await handleRefund(event);
      break;

    default:
      console.log(`Необработанное событие типа ${eventType}`);
  }
}

// ========================================
// Ручное списание (manual capture) после победы
// ========================================

export async function capturePayment(
  paymentId: number,
): Promise<{ success: boolean; paymentIntentId: string }> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      stripePaymentId: true,
      status: true,
      auctionId: true,
      userId: true,
    },
  });

  if (!payment) {
    throw createNotFoundError("Платёж не найден");
  }

  if (payment.status !== "AUTHORIZED") {
    throw createValidationError(
      `Платёж не в статусе холда (текущий: ${payment.status})`,
    );
  }

  if (!payment.stripePaymentId) {
    throw createValidationError("У платежа отсутствует Stripe ID");
  }

  // SECURITY: проверяем что аукцион завершён и пользователь — победитель
  const auction = await prisma.auction.findUnique({
    where: { id: payment.auctionId },
    select: { status: true, winnerId: true, endsAt: true },
  });

  if (!auction) {
    throw createNotFoundError("Аукцион не найден");
  }

  if (auction.status !== "COMPLETED") {
    throw createValidationError(
      "Списание возможно только после завершения аукциона",
    );
  }

  if (auction.winnerId !== payment.userId) {
    throw createValidationError(
      "Списание возможно только для победителя аукциона",
    );
  }

  if (auction.endsAt && new Date(auction.endsAt) > new Date()) {
    throw createValidationError("Аукцион ещё не завершён по времени");
  }

  // Списываем деньги (manual capture)
  const capturedIntent = await stripe.paymentIntents.capture(
    payment.stripePaymentId,
  );

  // Обновляем статус в БД
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "COMPLETED" },
  });

  // Обновляем auction paidAt
  await updateAuctionPaidAt(prisma, payment.auctionId);

  console.log(
    `[CAPTURE] Ручное списание выполнено: paymentId=${payment.id}, piId=${capturedIntent.id}`,
  );

  return { success: true, paymentIntentId: capturedIntent.id };
}

// ========================================
// Отмена холда (если пользователь не победил)
// ========================================

export async function cancelHold(paymentId: number): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      stripePaymentId: true,
      status: true,
      auctionId: true,
      userId: true,
    },
  });

  if (!payment) {
    return; // Уже удалён
  }

  if (payment.status !== "AUTHORIZED") {
    return; // Не в статусе холда
  }

  // SECURITY: проверяем что аукцион завершён и пользователь НЕ победитель
  const auction = await prisma.auction.findUnique({
    where: { id: payment.auctionId },
    select: { status: true, winnerId: true },
  });

  if (!auction) {
    // Аукцион удалён — просто удаляем запись
    await prisma.payment.delete({ where: { id: payment.id } });
    return;
  }

  if (auction.winnerId === payment.userId) {
    // Победитель — холд НЕ отменяем (будет списан)
    return;
  }

  if (!payment.stripePaymentId) {
    // Удаляем запись из БД
    await prisma.payment.delete({ where: { id: payment.id } });
    return;
  }

  // Отменяем холд в Stripe
  try {
    await stripe.paymentIntents.cancel(payment.stripePaymentId);
    console.log(`[CANCEL] Холд отменён: paymentId=${payment.id}`);
  } catch (error) {
    // Холд мог истечь автоматически (24-168ч в зависимости от банка)
    console.warn(
      `[WARN] Не удалось отменить холд ${payment.stripePaymentId}:`,
      error,
    );
  }

  // Удаляем запись из БД
  await prisma.payment.delete({ where: { id: payment.id } });
}

// ========================================
// Получение истории платежей пользователя
// ========================================

export async function getPaymentHistory(
  userId: number,
  options: GetPaymentHistoryOptions,
): Promise<GetPaymentHistoryResult> {
  const { page, limit } = options;

  // Валидация параметров пагинации
  if (limit <= 0 || !Number.isInteger(limit)) {
    throw createValidationError("Limit must be a positive integer");
  }
  if (page < 1 || !Number.isInteger(page)) {
    throw createValidationError("Page must be a positive integer");
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

// ========================================
// Возврат платежа (Refund)
// ========================================

export async function refundPayment(
  paymentId: number,
  adminId: number,
  reason?: string,
): Promise<RefundPaymentResult> {
  // Находим платёж с данными аукциона
  const payment = await getPaymentByIdWithAuction(prisma, paymentId);

  if (!payment) {
    throw createNotFoundError("Платёж не найден");
  }

  if (payment.status !== "COMPLETED") {
    throw createValidationError(
      "Возврат возможен только для завершённых платежей",
    );
  }

  if (!payment.stripePaymentId) {
    throw createValidationError(
      "У платежа отсутствует Stripe ID — возврат невозможен",
    );
  }

  // Создаём возврат в Stripe
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentId,
    reason: "requested_by_customer",
    metadata: {
      adminId: adminId.toString(),
      refundReason: reason ?? "Административный возврат",
    },
  });

  // Обновляем статус платежа в БД
  await updatePayment(prisma, payment.id, {
    status: "REFUNDED",
    refundReason: reason ?? "Административный возврат",
  });

  console.log(
    `Возврат ${refund.id} для платежа ${payment.stripePaymentId} создан администратором ${adminId}`,
  );

  return {
    refundId: refund.id,
    payment: {
      ...payment,
      status: "REFUNDED" as const,
      refundReason: reason ?? "Административный возврат",
    } as PaymentWithRelations,
  };
}
