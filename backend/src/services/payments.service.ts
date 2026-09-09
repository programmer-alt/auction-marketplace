import { Prisma, type PrismaClient } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "../config/db";
import { createForbiddenError, createNotFoundError, createValidationError } from "../errors/factories";
import {
  getPaymentByIdWithAuction,
  getPaymentByStripeId,
  getPaymentsByUserId,
  getPaymentsCountByUserId,
  getPendingPaymentByAuctionAndUser,
  updateAuctionPaidAt,
  updatePayment,
} from "../repositories/payments.repository";
import type { Payment, PaymentWithAuctionSeller, PaymentWithRelations } from "../types";

// ========================================
// Инициализация Stripe
// ========================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
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

export interface RefundPaymentResult {
  refundId: string;
  payment: PaymentWithRelations;
}

// ========================================
// Создание Payment Intent
// ========================================

export async function createPaymentIntent(auctionId: number, userId: number): Promise<CreatePaymentIntentResult> {
  // Проверяем аукцион
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: {
      id: true,
      status: true,
      endsAt: true,
      currentPrice: true,
      winnerId: true,
      currency: true,
      title: true,
    },
  });

  if (!auction) {
    throw createNotFoundError("Аукцион не найден");
  }

  // Проверяем, что аукцион завершён (статус COMPLETED ИЛИ время вышло + есть победитель)
  const isCompleted = auction.status === "COMPLETED";
  const isTimeEnded = auction.endsAt && new Date(auction.endsAt) <= new Date();
  const hasWinner = auction.winnerId !== null;

  if (!isCompleted && !(isTimeEnded && hasWinner)) {
    throw createValidationError("Аукцион ещё не завершён");
  }

  // Проверяем авторизацию до обновления статуса — сайд-эффект не должен происходить для неавторизованных пользователей
  if (auction.winnerId !== userId) {
    throw createForbiddenError("Вы не являетесь победителем этого аукциона");
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
    throw createValidationError("Этот аукцион уже оплачен");
  }

  // Проверяем, есть ли PENDING-платёж — возвращаем его clientSecret
  const existingPendingPayment = await getPendingPaymentByAuctionAndUser(prisma, auctionId, userId);

  if (existingPendingPayment?.stripePaymentId) {
    // Возвращаем существующий clientSecret
    const existingIntent = await stripe.paymentIntents.retrieve(existingPendingPayment.stripePaymentId);

    return {
      clientSecret: existingIntent.client_secret,
      payment: existingPendingPayment,
    };
  }

  // Сумма к оплате (текущая цена аукциона)
  const currency = auction.currency.toLowerCase(); // гарантируем нижний регистр

  // Поддержка валют с нулевым количеством десятичных знаков (JPY, KRW, VND)
  const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw", "vnd"]);
  const amount = ZERO_DECIMAL_CURRENCIES.has(currency)
    ? Math.round(auction.currentPrice.toNumber())
    : Math.round(auction.currentPrice.toNumber() * 100);

  // Создаём Payment Intent в Stripe с manual capture (холдирование)
  // Деньги замораживаются на карте, но не списываются
  // Списываются только после завершения торгов и manual capture
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method_types: ["card"],
    capture_method: "manual", // холдирование — не списывать сразу
    metadata: {
      auctionId: auction.id.toString(),
      userId: userId.toString(),
      auctionTitle: auction.title ?? "",
    },
  });

  // Атомарное обновление статуса аукциона + создание платежа
  // Статус больше не меняется отдельным запросом — это устраняет race condition,
  // о котором предупреждал Sourcery: теперь статус и платёж создаются одновременно
  // в одной транзакции, и только после проверки winnerId.
  let payment: PaymentWithRelations;
  try {
    const [_updatedAuction, createdPayment] = await prisma.$transaction([
      // Обновляем статус аукциона в COMPLETED (атомарно, вместе с созданием платежа)
      prisma.auction.update({
        where: {
          id: auctionId,
          status: { in: ["COMPLETED"] },
        },
        data: { status: "COMPLETED" },
      }),
      // Создаём запись о платеже со статусом AUTHORIZED (холд создан)
      prisma.payment.create({
        data: {
          userId,
          auctionId,
          amount: auction.currentPrice,
          currency,
          stripePaymentId: paymentIntent.id,
          status: "AUTHORIZED", // холд создан, но деньги не списаны
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
          auction: {
            select: {
              id: true,
              title: true,
              currentPrice: true,
              currency: true,
            },
          },
        },
      }),
    ]);

    payment = createdPayment;
  } catch (error) {
    // Отменяем PaymentIntent в Stripe только для ошибок, которые
    // действительно означают, что платёж больше не нужен.
    // Для временных ошибок (сеть, БД) — не трогаем Stripe,
    // чтобы клиент мог повторить попытку тем же PaymentIntent.
    const isApplicationError = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"; // Prisma record not found

    if (isApplicationError) {
      // Аукцион больше не в нужном статусе (CANCELLED и т.д.) —
      // race condition между проверкой и транзакцией.
      // Отменяем PaymentIntent, т.к. платёж заведомо не нужен.
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id);
      } catch (stripeError) {
        console.error(
          `[WARN] Не удалось отменить PaymentIntent ${paymentIntent.id} после ошибки транзакции:`,
          stripeError,
        );
      }

      throw createValidationError("Невозможно создать платёж: аукцион больше не доступен для оплаты");
    }

    // Для всех остальных ошибок (временные сбои БД, сети и т.п.)
    // не отменяем PaymentIntent — клиент может повторить попытку.
    throw error;
  }

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
  extraCheck?: (payment: Payment, paymentIntent: Stripe.PaymentIntent) => Promise<void>,
): Promise<void> {
  const payment = await getPaymentByStripeId(prisma, stripePaymentId);

  if (payment) {
    if (extraCheck && paymentIntent) {
      await extraCheck(payment, paymentIntent);
    }
    await updatePayment(prisma, payment.id, { status: paymentStatus });
    console.log(logMessage);
  } else {
    console.error(`[ALERT] Платёж с stripePaymentId ${stripePaymentId} не найден в БД`);
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
    const expectedAmount = ZERO_DECIMAL_CURRENCIES.has(payment.currency.toLowerCase())
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
    console.log(`[CAPTURE] Платёж ${stripePaymentId} успешно списан, paymentId=${payment.id}`);
  } else {
    console.error(
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
  await handlePaymentIntentEvent(prisma, paymentIntent.id, paymentStatus, fullLogMessage, paymentIntent);
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
      console.error(`[ALERT] Платёж с stripePaymentId ${stripePaymentId} не найден в БД при обработке возврата`);
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
          console.log(`[AUTH] PaymentIntent готов к capture, paymentId=${payment.id}`);
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

export async function capturePayment(paymentId: number): Promise<{ success: boolean; paymentIntentId: string }> {
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
    throw createValidationError(`Платёж не в статусе холда (текущий: ${payment.status})`);
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
    throw createValidationError("Списание возможно только после завершения аукциона");
  }

  if (auction.winnerId !== payment.userId) {
    throw createValidationError("Списание возможно только для победителя аукциона");
  }

  if (auction.endsAt && new Date(auction.endsAt) > new Date()) {
    throw createValidationError("Аукцион ещё не завершён по времени");
  }

  // Списываем деньги (manual capture)
  const capturedIntent = await stripe.paymentIntents.capture(payment.stripePaymentId);

  // Обновляем статус в БД
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "COMPLETED" },
  });

  // Обновляем auction paidAt
  await updateAuctionPaidAt(prisma, payment.auctionId);

  console.log(`[CAPTURE] Ручное списание выполнено: paymentId=${payment.id}, piId=${capturedIntent.id}`);

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
    console.warn(`[WARN] Не удалось отменить холд ${payment.stripePaymentId}:`, error);
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

export async function refundPayment(paymentId: number, adminId: number, reason?: string): Promise<RefundPaymentResult> {
  // Находим платёж с данными аукциона
  const payment = await getPaymentByIdWithAuction(prisma, paymentId);

  if (!payment) {
    throw createNotFoundError("Платёж не найден");
  }

  if (payment.status !== "COMPLETED") {
    throw createValidationError("Возврат возможен только для завершённых платежей");
  }

  if (!payment.stripePaymentId) {
    throw createValidationError("У платежа отсутствует Stripe ID — возврат невозможен");
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

  console.log(`Возврат ${refund.id} для платежа ${payment.stripePaymentId} создан администратором ${adminId}`);

  return {
    refundId: refund.id,
    payment: {
      ...payment,
      status: "REFUNDED" as const,
      refundReason: reason ?? "Административный возврат",
    } as PaymentWithRelations,
  };
}
