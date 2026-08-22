import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as paymentsRepo from "./payments.repository";

// Мокаем PrismaClient
const mockPaymentCreate = vi.fn();
const mockPaymentFindFirst = vi.fn();
const mockPaymentFindMany = vi.fn();
const mockPaymentUpdate = vi.fn();
const mockPaymentCount = vi.fn();
const mockPaymentFindUnique = vi.fn();
const mockPaymentDelete = vi.fn();

const mockPrisma = {
  payment: {
    create: mockPaymentCreate,
    findFirst: mockPaymentFindFirst,
    findMany: mockPaymentFindMany,
    update: mockPaymentUpdate,
    count: mockPaymentCount,
    findUnique: mockPaymentFindUnique,
    delete: mockPaymentDelete,
  },
} as any;

describe("Payments Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPayment", () => {
    it("должен создать новый платёж", async () => {
      const paymentData = {
        userId: 1,
        auctionId: 2,
        amount: new Prisma.Decimal(500),
        currency: "usd",
        stripePaymentId: "pi_test123",
        status: "PENDING",
      };
      const mockCreated = {
        id: 1,
        ...paymentData,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 1, email: "user@test.com", name: "User" },
        auction: { id: 2, title: "Test Auction", currentPrice: 500, currency: "usd" },
      };
      mockPaymentCreate.mockResolvedValue(mockCreated);

      const result = await paymentsRepo.createPayment(mockPrisma, paymentData);

      expect(mockPaymentCreate).toHaveBeenCalledWith({
        data: paymentData,
        include: expect.objectContaining({
          user: expect.any(Object),
          auction: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe("getPaymentByStripeId", () => {
    it("должен найти платёж по stripePaymentId", async () => {
      const mockPayment = {
        id: 1,
        userId: 1,
        stripePaymentId: "pi_test123",
        status: "PENDING",
      };
      mockPaymentFindFirst.mockResolvedValue(mockPayment);

      const result = await paymentsRepo.getPaymentByStripeId(mockPrisma, "pi_test123");

      expect(mockPaymentFindFirst).toHaveBeenCalledWith({
        where: { stripePaymentId: "pi_test123" },
      });
      expect(result).toEqual(mockPayment);
    });

    it("должен вернуть null, если платёж не найден", async () => {
      mockPaymentFindFirst.mockResolvedValue(null);

      const result = await paymentsRepo.getPaymentByStripeId(mockPrisma, "pi_unknown");

      expect(result).toBeNull();
    });
  });

  describe("updatePayment", () => {
    it("должен обновить платёж", async () => {
      const mockUpdated = {
        id: 1,
        userId: 1,
        status: "COMPLETED",
        stripePaymentId: "pi_test123",
      };
      mockPaymentUpdate.mockResolvedValue(mockUpdated);

      const result = await paymentsRepo.updatePayment(mockPrisma, 1, { status: "COMPLETED" });

      expect(mockPaymentUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: "COMPLETED" },
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("getPaymentsByUserId", () => {
    it("должен вернуть платежи пользователя с пагинацией", async () => {
      const mockPayments = [
        {
          id: 1,
          userId: 1,
          amount: new Prisma.Decimal(500),
          status: "COMPLETED",
          createdAt: new Date(),
          auction: {
            id: 2,
            title: "Test Auction",
            imageUrl: "https://example.com/img.jpg",
            seller: { id: 3, name: "Seller" },
          },
        },
      ];
      mockPaymentFindMany.mockResolvedValue(mockPayments);

      const result = await paymentsRepo.getPaymentsByUserId(mockPrisma, 1, 0, 20);

      expect(mockPaymentFindMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: expect.objectContaining({
          auction: expect.any(Object),
        }),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual(mockPayments);
    });

    it("должен вернуть пустой массив, если платежей нет", async () => {
      mockPaymentFindMany.mockResolvedValue([]);

      const result = await paymentsRepo.getPaymentsByUserId(mockPrisma, 1, 0, 20);

      expect(result).toEqual([]);
    });
  });

  describe("getPaymentsCountByUserId", () => {
    it("должен вернуть количество платежей пользователя", async () => {
      mockPaymentCount.mockResolvedValue(5);

      const result = await paymentsRepo.getPaymentsCountByUserId(mockPrisma, 1);

      expect(mockPaymentCount).toHaveBeenCalledWith({ where: { userId: 1 } });
      expect(result).toBe(5);
    });
  });

  describe("getPaymentById", () => {
    it("должен вернуть платёж по ID", async () => {
      const mockPayment = {
        id: 1,
        userId: 1,
        amount: new Prisma.Decimal(500),
        status: "COMPLETED",
        user: { id: 1, email: "user@test.com", name: "User" },
        auction: { id: 2, title: "Test Auction", currentPrice: 500, currency: "usd" },
      };
      mockPaymentFindUnique.mockResolvedValue(mockPayment);

      const result = await paymentsRepo.getPaymentById(mockPrisma, 1);

      expect(mockPaymentFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          user: expect.any(Object),
          auction: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockPayment);
    });

    it("должен вернуть null, если платёж не найден", async () => {
      mockPaymentFindUnique.mockResolvedValue(null);

      const result = await paymentsRepo.getPaymentById(mockPrisma, 999);

      expect(result).toBeNull();
    });
  });

  describe("deletePayment", () => {
    it("должен удалить платёж", async () => {
      const mockDeleted = {
        id: 1,
        userId: 1,
        amount: new Prisma.Decimal(500),
        status: "PENDING",
      };
      mockPaymentDelete.mockResolvedValue(mockDeleted);

      const result = await paymentsRepo.deletePayment(mockPrisma, 1);

      expect(mockPaymentDelete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockDeleted);
    });
  });
});
