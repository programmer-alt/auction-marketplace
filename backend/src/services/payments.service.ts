import Stripe from "stripe";
import { prisma } from "../config/db";
import {
  createForbiddenError,
  createNotFoundError,
  createValidationError,
} from "../errors/factories";
import {
  getPaymentByIdWithAuction,
  getPaymentByStripeId,
  getPaymentsByUserId,
  getPaymentsCountByUserId,
  getPendingPaymentByAuctionAndUser,
  updateAuctionPaidAt,
  updatePayment,
} from "../repositories/payments.repository";
import type { PaymentWithAuctionSeller, PaymentWithRelations } from "../types";

// ========================================
// Инициализация Stripe
// ========================================

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
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
  const existingPendingPayment = await getPendingPaymentByAuctionAndUser(
    prisma,
    auctionId,
    userId,
  );

  if (existingPendingPayment?.stripePaymentId) {
    // Возвращаем существующий clientSecret
    const existingIntent = await stripe.paymentIntents.retrieve(
      existingPendingPayment.stripePaymentId,
    );

    return {
      clientSecret: existingIntent.client_secret,
      payment: existingPendingPayment,
    };
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
          status: { in: ["ACTIVE", "COMPLETED"] },
        },
        data: { status: "COMPLETED" },
      }),
      // Создаём запись о платеже
      prisma.payment.create({
        data: {
          userId,
          auctionId,
          amount: auction.currentPrice,
          currency,
          stripePaymentId: paymentIntent.id,
          status: "PENDING",
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
    // Если транзакция не удалась, отменяем PaymentIntent в Stripe,
    try {
      await stripe.paymentIntents.cancel(paymentIntent.id);
    } catch (stripeError) {
      console.error(
        `[WARN] Не удалось отменить PaymentIntent ${paymentIntent.id} после ошибки транзакции:`,
        stripeError,
      );
    }

    // Если аукцион больше не в нужном статусе (CANCELLED и т.д.) — race condition
    // между проверкой и транзакцией. Отклоняем платёж.
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      throw createValidationError(
        "Невозможно создать платёж: аукцион больше не доступен для оплаты",
      );
    }
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
        // Defense in depth: проверяем, что сумма PI совпадает с суммой в БД
        const expectedAmount = Math.round(payment.amount.toNumber() * 100);
        if (paymentIntent.amount !== expectedAmount) {
          console.error(
            `[SECURITY] Сумма PaymentIntent (${paymentIntent.amount}) не совпадает с суммой в БД (${expectedAmount}). ` +
              `stripePaymentId=${stripePaymentId}, paymentId=${payment.id}`,
          );
          await updatePayment(prisma, payment.id, { status: "FAILED" });
          break;
        }

        await updatePayment(prisma, payment.id, { status: "COMPLETED" });

        // Обновляем paidAt у аукциона
        await updateAuctionPaidAt(prisma, payment.auctionId);

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

    case "payment_intent.canceled": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const stripePaymentId = paymentIntent.id;

      const payment = await getPaymentByStripeId(prisma, stripePaymentId);

      if (payment) {
        await updatePayment(prisma, payment.id, { status: "FAILED" });
        console.log(`Платёж ${stripePaymentId} отменён`);
      } else {
        console.warn(
          `Платёж с stripePaymentId ${stripePaymentId} не найден в БД`,
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const stripePaymentId = charge.payment_intent as string;

      if (stripePaymentId) {
        const payment = await getPaymentByStripeId(prisma, stripePaymentId);

        if (payment) {
          await updatePayment(prisma, payment.id, { status: "REFUNDED" });
          console.log(`Возврат для платежа ${stripePaymentId} обработан`);
        } else {
          console.warn(
            `Платёж с stripePaymentId ${stripePaymentId} не найден в БД при обработке возврата`,
          );
        }
      }
      break;
    }

    default:
      console.log(`Необработанное событие типа ${event.type}`);
  }
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

  // Получаем обновлённый платёж
  const updatedPayment = await getPaymentByIdWithAuction(prisma, paymentId);

  return {
    refundId: refund.id,
    payment: updatedPayment as PaymentWithRelations,
  };
}
