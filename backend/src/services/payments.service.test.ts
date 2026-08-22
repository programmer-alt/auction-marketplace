import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as paymentsRepo from "../repositories/payments.repository";
import * as paymentsService from "./payments.service";

// Мокаем Stripe через vi.hoisted
const { mockPaymentIntentsCreate, mockWebhooksConstructEvent } = vi.hoisted(() => ({
  mockPaymentIntentsCreate: vi.fn(),
  mockWebhooksConstructEvent: vi.fn(),
}));

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      paymentIntents: {
        create: mockPaymentIntentsCreate,
      },
      webhooks: {
        constructEvent: mockWebhooksConstructEvent,
      },
    })),
  };
});

vi.mock("../config/db", () => ({
  prisma: {
    auction: {
      findUnique: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("../repositories/payments.repository");
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

// Импортируем моканые модули
import { prisma } from "../config/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockCreatePayment = vi.mocked(paymentsRepo.createPayment);
const mockGetPaymentByStripeId = vi.mocked(paymentsRepo.getPaymentByStripeId);
const mockUpdatePayment = vi.mocked(paymentsRepo.updatePayment);
const mockGetPaymentsByUserId = vi.mocked(paymentsRepo.getPaymentsByUserId);
const mockGetPaymentsCountByUserId = vi.mocked(paymentsRepo.getPaymentsCountByUserId);

describe("Payments Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Переопределяем STRIPE_SECRET_KEY для мока
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
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
      mockPrisma.auction.findUnique.mockResolvedValue(mockCompletedAuction);
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPaymentIntentsCreate.mockResolvedValue({
        id: "pi_test123",
        client_secret: "pi_test123_secret",
      });
      mockCreatePayment.mockResolvedValue({
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
          currentPrice: 500,
          currency: "usd",
        },
      });

      const result = await paymentsService.createPaymentIntent(auctionId, userId);

      expect(mockPrisma.auction.findUnique).toHaveBeenCalledWith({
        where: { id: auctionId },
        include: { winner: true, seller: true },
      });
      expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
        amount: 50000, // 500 * 100
        currency: "usd",
        metadata: { auctionId: "1", userId: "2" },
        description: "Оплата аукциона: Test Auction",
      });
      expect(mockCreatePayment).toHaveBeenCalled();
      expect(result.clientSecret).toBe("pi_test123_secret");
    });

    it("должен выбросить 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      await expect(paymentsService.createPaymentIntent(auctionId, userId)).rejects.toThrow("Аукцион не найден");
    });

    it("должен выбросить 400, если аукцион ещё не завершён", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        ...mockCompletedAuction,
        status: "ACTIVE",
      });

      await expect(paymentsService.createPaymentIntent(auctionId, userId)).rejects.toThrow("Аукцион ещё не завершён");
    });

    it("должен выбросить 403, если пользователь не победитель", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        ...mockCompletedAuction,
        winnerId: 99, // другой пользователь
      });

      await expect(paymentsService.createPaymentIntent(auctionId, userId)).rejects.toThrow(
        "Вы не являетесь победителем этого аукциона",
      );
    });

    it("должен выбросить 400, если аукцион уже оплачен", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(mockCompletedAuction);
      mockPrisma.payment.findFirst.mockResolvedValue({
        id: 1,
        status: "COMPLETED",
        userId,
        auctionId,
      } as any);

      await expect(paymentsService.createPaymentIntent(auctionId, userId)).rejects.toThrow("Этот аукцион уже оплачен");
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
          object: { id: "pi_test123" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue({
        id: 1,
        stripePaymentId: "pi_test123",
        status: "PENDING",
      });
      mockUpdatePayment.mockResolvedValue({} as any);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(Buffer.from("{}"), "sig_test", "whsec_test_secret");
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
      });
      mockUpdatePayment.mockResolvedValue({} as any);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(mockUpdatePayment).toHaveBeenCalledWith(mockPrisma, 2, {
        status: "FAILED",
      });
    });

    it("должен залогировать предупреждение, если платёж не найден (succeeded)", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const mockEvent = {
        type: "payment_intent.succeeded",
        data: {
          object: { id: "pi_unknown" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue(null);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Платёж с stripePaymentId pi_unknown не найден"),
      );
      consoleWarnSpy.mockRestore();
    });

    it("должен залогировать предупреждение, если платёж не найден (failed)", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const mockEvent = {
        type: "payment_intent.payment_failed",
        data: {
          object: { id: "pi_unknown2" },
        },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);
      mockGetPaymentByStripeId.mockResolvedValue(null);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Платёж с stripePaymentId pi_unknown2 не найден"),
      );
      consoleWarnSpy.mockRestore();
    });

    it("должен залогировать необработанное событие", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const mockEvent = {
        type: "charge.refunded",
        data: { object: { id: "ch_test" } },
      };
      mockWebhooksConstructEvent.mockReturnValue(mockEvent);

      await paymentsService.handleWebhook(Buffer.from("{}"), "sig_test");

      expect(consoleLogSpy).toHaveBeenCalledWith("Необработанное событие типа charge.refunded");
      consoleLogSpy.mockRestore();
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
});
