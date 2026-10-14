import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as paymentsRepo from "../repositories/payments.repository";
import * as paymentsService from "./payments.service";

// Мокаем Stripe через vi.hoisted
const {
  mockPaymentIntentsCreate,
  mockWebhooksConstructEvent,
  mockRefundsCreate,
  mockPaymentIntentsRetrieve,
  mockPaymentIntentsCancel,
  mockPaymentIntentsCapture,
} = vi.hoisted(() => ({
  mockPaymentIntentsCreate: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
  mockRefundsCreate: vi.fn(),
  mockPaymentIntentsRetrieve: vi.fn(),
  mockPaymentIntentsCancel: vi.fn(),
  mockPaymentIntentsCapture: vi.fn(),
}));

vi.mock("stripe", () => {
  class Stripe {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentIntents: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webhooks: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refunds: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static errors: any;

    constructor() {
      this.paymentIntents = {
        create: mockPaymentIntentsCreate,
        retrieve: mockPaymentIntentsRetrieve,
        cancel: mockPaymentIntentsCancel,
        capture: mockPaymentIntentsCapture,
      };
      this.webhooks = {
        constructEvent: mockWebhooksConstructEvent,
      };
      this.refunds = {
        create: mockRefundsCreate,
      };
    }
  }
  Stripe.errors = {
    StripeSignatureVerificationError: class StripeSignatureVerificationError extends Error {
      declare raw: unknown;
      declare header: unknown;
      constructor(message: string) {
        super(message);
        this.name = "StripeSignatureVerificationError";
      }
    },
  };
  return { default: Stripe };
});

vi.mock("../config/db", () => ({
  prisma: {
    auction: {
      findUnique: vi.fn(), // Мокаем prisma.auction.findUnique напрямую
      update: vi.fn().mockImplementation(async () => ({ id: 1, status: "COMPLETED" })),
    },
    payment: {
      findFirst: vi.fn(),
      create: vi.fn().mockImplementation(async () => ({
        id: 1,
        userId: 1,
        auctionId: 1,
        amount: new Prisma.Decimal(500),
        currency: "usd",
        stripePaymentId: "pi_test",
        status: "PENDING",
      })),
      findUnique: vi.fn(),
      update: vi.fn().mockImplementation(async () => ({
        id: 1,
        userId: 1,
        auctionId: 1,
        amount: new Prisma.Decimal(500),
        currency: "usd",
        stripePaymentId: "pi_test",
        status: "COMPLETED",
      })),
      delete: vi.fn().mockImplementation(async () => ({
        id: 1,
        userId: 1,
        auctionId: 1,
        amount: new Prisma.Decimal(500),
        currency: "usd",
        stripePaymentId: "pi_test",
        status: "PENDING",
      })),
    },
    $transaction: vi.fn().mockImplementation(async (queries: any[]) => {
      // Выполнить каждый запрос и вернуть массив результатов
      const results: any[] = [];
      for (const query of queries) {
        results.push(await query);
      }
      return results;
    }),
  },
  runWithRetry: (fn: () => Promise<any>) => fn(),
}));

vi.mock("../repositories/payments.repository");
// Мокаем auctions.repository
vi.mock("../repositories/auctions.repository", () => ({
  getAuctionById: vi.fn(),
}));
vi.mock("../repositories/users.repository", () => ({
  getUserById: vi.fn(),
}));
vi.mock("../errors/factories", () => ({
  createNotFoundError: vi.fn((msg: string) => {
    const err = new Error(msg) as Error & {
      errorType: string;
      statusCode: number;
    };
    err.errorType = "NOT_FOUND";
    err.statusCode = 404;
    return err;
  }),
  createValidationError: vi.fn((msg: string) => {
    const err = new Error(msg) as Error & {
      errorType: string;
      statusCode: number;
    };
    err.errorType = "VALIDATION";
    err.statusCode = 400;
    return err;
  }),
  createForbiddenError: vi.fn((msg: string) => {
    const err = new Error(msg) as Error & {
      errorType: string;
      statusCode: number;
    };
    err.errorType = "FORBIDDEN";
    err.statusCode = 403;
    return err;
  }),
}));

vi.mock("../config/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Импортируем моканые модули
import { prisma } from "../config/db";
import * as usersRepo from "../repositories/users.repository";
import logger from "../config/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const _mockTransaction = vi.mocked(mockPrisma.$transaction);
const mockGetUserById = vi.mocked(usersRepo.getUserById);
const mockGetPaymentByStripeId = vi.mocked(paymentsRepo.getPaymentByStripeId);
const mockUpdatePayment = vi.mocked(paymentsRepo.updatePayment);
const mockCreatePayment = vi.mocked(paymentsRepo.createPayment);
const mockGetPaymentsByUserId = vi.mocked(paymentsRepo.getPaymentsByUserId);
const mockGetPaymentsCountByUserId = vi.mocked(paymentsRepo.getPaymentsCountByUserId);
const mockGetPaymentByIdWithAuction = vi.mocked(paymentsRepo.getPaymentByIdWithAuction);
const mockUpdateAuctionPaidAt = vi.mocked(paymentsRepo.updateAuctionPaidAt);

describe("Payments Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Переопределяем STRIPE_SECRET_KEY для мока (тестовые значения)
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_fake_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock_test_secret";
  });

  // ========================================
  // createPaymentIntent
  // ========================================
  describe("createPaymentIntent", () => {
    const auctionId = 1;
    const userId = 2;

    const mockCompletedAuction = {
      id: auctionId,
      title: "Test Auction",
      currentPrice: new Prisma.Decimal(500),
      currency: "usd",
      status: "COMPLETED",
      winnerId: userId,
      sellerId: 3,
      seller: { id: 3, email: "seller@test.com", name: "Seller" },
      winner: { id: userId, email: "winner@test.com", name: "Winner" },
    };

    it("должен успешно создать Payment Intent", async () => {
      const mockPayment = {
        id: 1,
        userId,
        auctionId,
        amount: new Prisma.Decimal(500),
        currency: "usd",
        stripePaymentId: "pi_test123",
        status: "PENDING",
        user: { id: userId, email: "winner@test.com", name: "Winner" },
        auction: {
          id: auctionId,
          title: "Test Auction",
          currentPrice: new Prisma.Decimal(500),
          currency: "usd",
        },
      };
      const mockAuctionsRepo = await import("../repositories/auctions.repository");
      (mockAuctionsRepo.getAuctionById as any).mockResolvedValue(mockCompletedAuction);
      mockGetUserById.mockResolvedValue({
        id: userId,
        email: "winner@test.com",
        name: "Winner",
        balance: new Prisma.Decimal(0),
        createdAt: new Date(),
      });

      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_test123",
        client_secret: "pi_test123_secret",
      });
      mockCreatePayment.mockResolvedValue(mockPayment);

      const result = await paymentsService.createPaymentIntent(auctionId, userId, "US"); // Добавляем countryCode

      expect(mockAuctionsRepo.getAuctionById).toHaveBeenCalledWith(expect.anything(), auctionId);
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 50000, // 500 * 100
        currency: "usd",
        description: "Оплата аукциона: Test Auction",
        capture_method: "manual",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          // Обновляем ожидаемые метаданные
          auctionId: "1",
          userId: "2",
          countryCode: "US", // Добавляем countryCode
        },
      });
      expect(mockCreatePayment).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId,
          auctionId,
          amount: mockCompletedAuction.currentPrice,
          currency: "USD", // Сохраняется в верхнем регистре
          stripePaymentId: "pi_test123",
          status: "PENDING",
        }),
      );
      expect(result.clientSecret).toBe("pi_test123_secret");
    });

    it("должен выбросить 404, если аукцион не найден", async () => {
      const mockAuctionsRepo = await import("../repositories/auctions.repository");
      (mockAuctionsRepo.getAuctionById as any).mockResolvedValue(null);

      await expect(paymentsService.createPaymentIntent(auctionId, userId, "US")).rejects.toThrow("Аукцион не найден");
    });

    it("должен выбросить ошибку, если пользователь продавец аукциона", async () => {
      const mockAuctionsRepo = await import("../repositories/auctions.repository");
      (mockAuctionsRepo.getAuctionById as any).mockResolvedValue(mockCompletedAuction);
      mockGetUserById.mockResolvedValue({
        id: userId,
        email: "winner@test.com",
        name: "Winner",
        balance: new Prisma.Decimal(0),
        createdAt: new Date(),
      });

      await expect(paymentsService.createPaymentIntent(auctionId, mockCompletedAuction.sellerId, "US")).rejects.toThrow(
        "Нельзя оплатить свой собственный аукцион",
      );
    });
  });

  // ========================================
  // handleWebhook
  // ========================================
  describe("handleWebhook", () => {
    it("должен обработать payment_intent.succeeded", async () => {
      const mockEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_test123", amount: 50000 },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 1,
        stripePaymentId: "pi_test123",
        status: "PENDING",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });
      mockUpdatePayment.mockResolvedValue({} as any);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(Buffer.from("{}"), "sig_test", "whsec_mock_test_secret");
      expect(mockGetPaymentByStripeId).toHaveBeenCalledWith(mockPrisma, "pi_test123");
      expect(mockUpdatePayment).toHaveBeenCalledWith(mockPrisma, 1, {
        status: "COMPLETED",
      });
    });

    it("должен обработать payment_intent.payment_failed", async () => {
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_test456" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 2,
        stripePaymentId: "pi_test456",
        status: "PENDING",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });
      mockUpdatePayment.mockResolvedValue({} as any);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).toHaveBeenCalledWith(mockPrisma, 2, {
        status: "FAILED",
      });
    });

    it("должен залогировать предупреждение, если платёж не найден (succeeded)", async () => {
      const mockEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_unknown" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue(null);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Платёж с stripePaymentId pi_unknown не найден"),
      );
    });

    it("должен залогировать предупреждение, если платёж не найден (failed)", async () => {
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_unknown2" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue(null);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Платёж с stripePaymentId pi_unknown2 не найден"),
      );
    });

    it("должен залогировать необработанное событие", async () => {
      const mockEvent = {
        type: "invoice.payment_failed",
        data: { object: { id: "in_test" } },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(logger.info).toHaveBeenCalledWith("Необработанное событие типа invoice.payment_failed");
    });

    it("должен пробросить ошибку при неверной сигнатуре", async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error("No signatures found matching the expected signature");
      });

      await expect(paymentsService.handleWebhook(Buffer.from("{}"), "bad_sig")).rejects.toThrow(
        "No signatures found matching the expected signature",
      );
    });
  });

  // ========================================
  // getPaymentHistory
  // ========================================
  describe("getPaymentHistory", () => {
    const userId = 1;

    it("должен вернуть историю платежей с пагинацией", async () => {
      const mockPayments = [
        {
          id: 1,
          amount: new Prisma.Decimal(500),
          currency: "usd",
          status: "COMPLETED",
          createdAt: new Date(),
          auction: {
            id: 1,
            title: "Test Auction",
            imageUrl: "https://example.com/img.jpg",
            seller: { id: 3, name: "Seller" },
          },
        },
      ];
      mockGetPaymentsByUserId.mockResolvedValue(mockPayments as any);
      mockGetPaymentsCountByUserId.mockResolvedValue(1);

      const result = await paymentsService.getPaymentHistory(userId, {
        page: 1,
        limit: 20,
      });

      expect(mockGetPaymentsByUserId).toHaveBeenCalledWith(mockPrisma, userId, 0, 20);
      expect(result.payments).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("должен вернуть пустой массив, если платежей нет", async () => {
      mockGetPaymentsByUserId.mockResolvedValue([]);
      mockGetPaymentsCountByUserId.mockResolvedValue(0);

      const result = await paymentsService.getPaymentHistory(userId, {
        page: 1,
        limit: 20,
      });

      expect(result.payments).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it("должен выбросить ошибку при невалидном limit", async () => {
      await expect(paymentsService.getPaymentHistory(userId, { page: 1, limit: -5 })).rejects.toThrow(
        "Limit must be a positive integer",
      );
    });

    it("должен выбросить ошибку при невалидном page", async () => {
      await expect(paymentsService.getPaymentHistory(userId, { page: 0, limit: 10 })).rejects.toThrow(
        "Page must be a positive integer",
      );
    });

    it("должен корректно рассчитать skip для третьей страницы", async () => {
      mockGetPaymentsByUserId.mockResolvedValue([]);
      mockGetPaymentsCountByUserId.mockResolvedValue(0);

      await paymentsService.getPaymentHistory(userId, { page: 3, limit: 10 });

      expect(mockGetPaymentsByUserId).toHaveBeenCalledWith(mockPrisma, userId, 20, 10);
    });
  });

  // ========================================
  // capturePayment
  // ========================================
  describe("capturePayment", () => {
    const mockPayment = {
      id: 1,
      stripePaymentId: "pi_test_capture",
      status: "AUTHORIZED" as const,
      auctionId: 1,
      userId: 2,
      currency: "usd",
      amount: new Prisma.Decimal(500),
    };

    const mockCompletedAuction = {
      id: 1,
      status: "COMPLETED" as const,
      winnerId: 2,
      endsAt: new Date(Date.now() - 3600000), // Завершился 1 час назад
      currentPrice: new Prisma.Decimal(500),
    };

    it("должен успешно списать платёж (AUTHORIZED → CAPTURED → COMPLETED)", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(mockCompletedAuction);
      mockPaymentIntentsCapture.mockResolvedValue({ id: "pi_test_capture", status: "succeeded" });

      const result = await paymentsService.capturePayment(1);

      // Первый update: AUTHORIZED → CAPTURED (optimistic)
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { status: "CAPTURED" },
        }),
      );

      // Вызов Stripe capture
      expect(mockPaymentIntentsCapture).toHaveBeenCalledWith("pi_test_capture");

      // Второй update: CAPTURED → COMPLETED + updateAuctionPaidAt
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: { status: "COMPLETED" },
        }),
      );
      expect(mockUpdateAuctionPaidAt).toHaveBeenCalledWith(mockPrisma, 1);

      expect(result).toEqual({ success: true, paymentIntentId: "pi_test_capture" });
    });

    it("должен выбросить 404, если платёж не найден", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await expect(paymentsService.capturePayment(999)).rejects.toThrow("Платёж не найден");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если платёж не в статусе холда (COMPLETED)", async () => {
      const alreadyCompletedPayment = { ...mockPayment, status: "COMPLETED" as const };
      mockPrisma.payment.findUnique.mockResolvedValue(alreadyCompletedPayment);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Платёж не в статусе холда");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если платёж не в статусе холда (FAILED)", async () => {
      const failedPayment = { ...mockPayment, status: "FAILED" as const };
      mockPrisma.payment.findUnique.mockResolvedValue(failedPayment);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Платёж не в статусе холда");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если отсутствует Stripe ID", async () => {
      const paymentWithoutStripeId = { ...mockPayment, stripePaymentId: null };
      mockPrisma.payment.findUnique.mockResolvedValue(paymentWithoutStripeId);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("У платежа отсутствует Stripe ID");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPrisma.auction.findUnique).not.toHaveBeenCalled();
    });

    it("должен выбросить 404, если аукцион не найден", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Аукцион не найден");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если аукцион не завершён (ACTIVE)", async () => {
      const activeAuction = { ...mockCompletedAuction, status: "ACTIVE" as const };
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(activeAuction);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Списание возможно только после завершения аукциона");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если пользователь не победитель", async () => {
      const notWinnerAuction = { ...mockCompletedAuction, winnerId: 99 };
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(notWinnerAuction);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Списание возможно только для победителя аукциона");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если аукцион ещё не завершился по времени", async () => {
      const futureAuction = { ...mockCompletedAuction, endsAt: new Date(Date.now() + 3600000) };
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(futureAuction);

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Аукцион ещё не завершён по времени");
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCapture).not.toHaveBeenCalled();
    });

    it("должен откатить статус на CAPTURE_PENDING при ошибке Stripe capture", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(mockCompletedAuction);
      mockPaymentIntentsCapture.mockRejectedValue(new Error("Stripe network error"));

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("Stripe network error");

      // Первый update: AUTHORIZED → CAPTURED (optimistic)
      const updateCalls = mockPrisma.payment.update.mock.calls;
      expect(updateCalls).toHaveLength(2);

      // Первый вызов: CAPTURED
      expect(updateCalls[0][0]).toEqual({
        where: { id: 1 },
        data: { status: "CAPTURED" },
      });

      // Откат: CAPTURED → CAPTURE_PENDING
      expect(updateCalls[1][0]).toEqual({
        where: { id: 1 },
        data: { status: "CAPTURE_PENDING" },
      });

      // updateAuctionPaidAt НЕ вызывается
      expect(mockUpdateAuctionPaidAt).not.toHaveBeenCalled();

      // В лог должна уйти warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] Не удалось списать paymentId=1"),
      );
    });

    it("должен пробросить ошибку, если Stripe capture успешен, но DB update упал", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(mockCompletedAuction);
      mockPaymentIntentsCapture.mockResolvedValue({ id: "pi_test_capture", status: "succeeded" });

      // Первый update (CAPTURED) успешный, второй (COMPLETED) падает
      mockPrisma.payment.update
        .mockImplementationOnce(async () => ({ id: 1, status: "CAPTURED" }))
        .mockImplementationOnce(async () => {
          throw new Error("DB connection lost");
        });

      await expect(paymentsService.capturePayment(1)).rejects.toThrow("DB connection lost");

      // В лог должна уйти error (первый аргумент — строка, второй — объект ошибки)
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR] Не удалось обновить статус после capture"),
        expect.any(Error),
      );
    });
  });

  // ========================================
  // cancelHold
  // ========================================
  describe("cancelHold", () => {
    const mockAuthorizedPayment = {
      id: 1,
      stripePaymentId: "pi_test_cancel",
      status: "AUTHORIZED" as const,
      auctionId: 1,
      userId: 2,
    };

    it("должен успешно отменить холд (AUTHORIZED → delete + Stripe cancel)", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockAuthorizedPayment);
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        status: "COMPLETED" as const,
        winnerId: 99, // Не наш пользователь
      });
      mockPrisma.payment.delete.mockResolvedValue(mockAuthorizedPayment);

      await paymentsService.cancelHold(1);

      expect(mockPrisma.payment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(mockPrisma.auction.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(mockPaymentIntentsCancel).toHaveBeenCalledWith("pi_test_cancel");
      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(logger.info).toHaveBeenCalledWith("[CANCEL] Холд отменён: paymentId=1");
    });

    it("должен тихо вернуть, если платёж не найден", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);

      await paymentsService.cancelHold(999);

      expect(mockPrisma.payment.delete).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Платёж 999 не найден при отмене холда"),
      );
    });

    it("должен пропустить отмену, если платёж не в статусе холда (лог, return)", async () => {
      const completedPayment = { ...mockAuthorizedPayment, status: "COMPLETED" as const };
      mockPrisma.payment.findUnique.mockResolvedValue(completedPayment);

      await paymentsService.cancelHold(1);

      expect(mockPrisma.payment.delete).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Платёж 1 не в статусе холда"),
      );
    });

    it("должен удалить запись, если аукцион не найден", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockAuthorizedPayment);
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      await paymentsService.cancelHold(1);

      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
    });

    it("должен НЕ отменить холд, если пользователь — победитель", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockAuthorizedPayment);
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        status: "COMPLETED" as const,
        winnerId: 2, // Тот же пользователь, что и payment.userId
      });

      await paymentsService.cancelHold(1);

      expect(mockPrisma.payment.delete).not.toHaveBeenCalled();
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("является победителем, холд не отменяется"),
      );
    });

    it("должен удалить запись, если отсутствует Stripe ID", async () => {
      const paymentWithoutStripeId = { ...mockAuthorizedPayment, stripePaymentId: null };
      mockPrisma.payment.findUnique.mockResolvedValue(paymentWithoutStripeId);
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        status: "COMPLETED" as const,
        winnerId: 99, // Не наш пользователь
      });

      await paymentsService.cancelHold(1);

      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockPaymentIntentsCancel).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("не имеет Stripe ID, запись удаляется"),
      );
    });

    it("должен удалить запись, даже если Stripe cancel упал", async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockAuthorizedPayment);
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        status: "COMPLETED" as const,
        winnerId: 99,
      });
      mockPaymentIntentsCancel.mockRejectedValue(new Error("Stripe cancel error"));

      await paymentsService.cancelHold(1);

      // Запись всё равно удалена
      expect(mockPrisma.payment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      // В лог должна уйти warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Не удалось отменить холд"),
        expect.any(Error),
      );
    });
  });

  // ========================================
  // refundPayment
  // ========================================
  describe("refundPayment", () => {
    const mockCompletedPayment = {
      id: 1,
      userId: 2,
      auctionId: 1,
      amount: new Prisma.Decimal(500),
      currency: "usd",
      stripePaymentId: "pi_test_refund",
      status: "COMPLETED" as const,
      user: { id: 2, email: "winner@test.com", name: "Winner" },
      auction: { id: 1, title: "Test Auction", currentPrice: new Prisma.Decimal(500), currency: "usd" },
    };

    it("должен успешно создать возврат (COMPLETED → REFUNDED)", async () => {
      mockGetPaymentByIdWithAuction.mockResolvedValue(mockCompletedPayment);
      mockRefundsCreate.mockResolvedValue({
        id: "re_test_refund",
        amount: 50000,
        status: "succeeded",
      });
      mockUpdatePayment.mockResolvedValue({ ...mockCompletedPayment, status: "REFUNDED" });

      const result = await paymentsService.refundPayment(1, 99, "Брак товара");

      expect(mockGetPaymentByIdWithAuction).toHaveBeenCalledWith(mockPrisma, 1);
      expect(mockRefundsCreate).toHaveBeenCalledWith({
        payment_intent: "pi_test_refund",
        reason: "requested_by_customer",
        metadata: {
          adminId: "99",
          refundReason: "Брак товара",
        },
      });
      expect(mockUpdatePayment).toHaveBeenCalledWith(mockPrisma, 1, {
        status: "REFUNDED",
        refundReason: "Брак товара",
      });
      expect(result.refundId).toBe("re_test_refund");
      expect(result.payment.status).toBe("REFUNDED");
      expect(result.payment.refundReason).toBe("Брак товара");
    });

    it("должен выбросить 404, если платёж не найден", async () => {
      mockGetPaymentByIdWithAuction.mockResolvedValue(null);

      await expect(paymentsService.refundPayment(999, 99)).rejects.toThrow("Платёж не найден");
      expect(mockRefundsCreate).not.toHaveBeenCalled();
      expect(mockUpdatePayment).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если платёж не в статусе COMPLETED", async () => {
      const pendingPayment = { ...mockCompletedPayment, status: "PENDING" as const };
      mockGetPaymentByIdWithAuction.mockResolvedValue(pendingPayment);

      await expect(paymentsService.refundPayment(1, 99)).rejects.toThrow(
        "Возврат возможен только для завершённых платежей",
      );
      expect(mockRefundsCreate).not.toHaveBeenCalled();
      expect(mockUpdatePayment).not.toHaveBeenCalled();
    });

    it("должен выбросить 400, если отсутствует Stripe ID", async () => {
      const paymentWithoutStripeId = { ...mockCompletedPayment, stripePaymentId: null };
      mockGetPaymentByIdWithAuction.mockResolvedValue(paymentWithoutStripeId);

      await expect(paymentsService.refundPayment(1, 99)).rejects.toThrow(
        "У платежа отсутствует Stripe ID — возврат невозможен",
      );
      expect(mockRefundsCreate).not.toHaveBeenCalled();
      expect(mockUpdatePayment).not.toHaveBeenCalled();
    });

    it("должен выбросить ошибку, если Stripe refunds.create упал", async () => {
      mockGetPaymentByIdWithAuction.mockResolvedValue(mockCompletedPayment);
      mockRefundsCreate.mockRejectedValue(new Error("Stripe API error"));

      await expect(paymentsService.refundPayment(1, 99)).rejects.toThrow("Stripe API error");

      // updatePayment НЕ вызывается, т.к. Stripe упал первым
      expect(mockUpdatePayment).not.toHaveBeenCalled();
    });

    it("должен использовать reason по умолчанию, если reason не передан", async () => {
      mockGetPaymentByIdWithAuction.mockResolvedValue(mockCompletedPayment);
      mockRefundsCreate.mockResolvedValue({
        id: "re_test_refund_default",
        amount: 50000,
        status: "succeeded",
      });
      mockUpdatePayment.mockResolvedValue({ ...mockCompletedPayment, status: "REFUNDED" });

      const result = await paymentsService.refundPayment(1, 99);

      expect(mockRefundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            refundReason: "Административный возврат",
          }),
        }),
      );
      expect(mockUpdatePayment).toHaveBeenCalledWith(
        mockPrisma,
        1,
        expect.objectContaining({
          refundReason: "Административный возврат",
        }),
      );
      expect(result.payment.refundReason).toBe("Административный возврат");
    });
  });

  // ========================================
  // Idempotency and terminal state protection
  // ========================================
  describe("Idempotency and terminal state protection", () => {
    it("должен пропустить дубликат payment_intent.succeeded (платёж уже COMPLETED)", async () => {
      const mockEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_test_idempotent", amount: 50000 },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 1,
        stripePaymentId: "pi_test_idempotent",
        status: "COMPLETED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      // updatePayment НЕ должен вызываться для терминального состояния
      expect(mockUpdatePayment).not.toHaveBeenCalled();
      // В лог должна уйти debug о пропуске дубликата
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("уже в терминальном статусе COMPLETED, пропускаем дубликат succeeded webhook"),
      );
    });

    it("должен пропустить дубликат payment_intent.payment_failed", async () => {
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_test_failed_dup" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 2,
        stripePaymentId: "pi_test_failed_dup",
        status: "FAILED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("уже в статусе FAILED, пропускаем дубликат события"),
      );
    });

    it("не должен перезаписать COMPLETED на FAILED (terminal state protection)", async () => {
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_test_terminal" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 3,
        stripePaymentId: "pi_test_terminal",
        status: "COMPLETED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      // Статус не должен измениться
      expect(mockUpdatePayment).not.toHaveBeenCalled();
      // В лог должна уйти warning
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("в терминальном статусе COMPLETED, игнорируем delayed failed/canceled webhook"),
      );
    });

    it("не должен перезаписать REFUNDED на FAILED (terminal state protection)", async () => {
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_test_refunded" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 4,
        stripePaymentId: "pi_test_refunded",
        status: "REFUNDED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: "Административный возврат",
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("в терминальном статусе REFUNDED, игнорируем delayed failed/canceled webhook"),
      );
    });

    it("должен пропустить delayed requires_capture для COMPLETED платежа", async () => {
      const mockEvent = {
        type: "payment_intent.requires_capture",
        data: {
          object: { id: "pi_test_delayed" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 5,
        stripePaymentId: "pi_test_delayed",
        status: "COMPLETED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("в статусе COMPLETED, игнорируем delayed requires_capture webhook"),
      );
    });

    it("должен пропустить delayed requires_capture для FAILED платежа", async () => {
      const mockEvent = {
        type: "payment_intent.requires_capture",
        data: {
          object: { id: "pi_test_failed_capture" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 6,
        stripePaymentId: "pi_test_failed_capture",
        status: "FAILED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("в статусе FAILED, игнорируем delayed requires_capture webhook"),
      );
    });

    it("должен пропустить дубликат requires_capture для AUTHORIZED платежа (idempotency)", async () => {
      const mockEvent = {
        type: "payment_intent.requires_capture",
        data: {
          object: { id: "pi_test_auth_dup" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 7,
        stripePaymentId: "pi_test_auth_dup",
        status: "AUTHORIZED",
        amount: new Prisma.Decimal(500),
        currency: "usd",
        auctionId: 1,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        refundReason: null,
      });

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      // updatePayment вызывается — это нормальное поведение для requires_capture
      expect(mockUpdatePayment).toHaveBeenCalledWith(mockPrisma, 7, { status: "AUTHORIZED" });
    });
  });
});


