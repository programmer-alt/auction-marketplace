import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import * as bidsService from "./bids.service";
import {
  getBidsByAuctionId,
  getBidsCountByAuctionId,
} from "../repositories/bids.repository";

// Мокаем модули
vi.mock("../config/db", () => ({
  prisma: {
    auction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bid: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../config/socket", () => ({
  getIo: vi.fn(() => ({
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  })),
}));

vi.mock("../repositories/bids.repository");
vi.mock("../errors/factories", () => ({
  createValidationError: vi.fn((msg: string) => {
    const err = new Error(msg) as Error & {
      errorType: string;
      statusCode: number;
    };
    err.errorType = "VALIDATION";
    err.statusCode = 400;
    return err;
  }),
  createNotFoundError: vi.fn((msg: string) => {
    const err = new Error(msg) as Error & {
      errorType: string;
      statusCode: number;
    };
    err.errorType = "NOT_FOUND";
    err.statusCode = 404;
    return err;
  }),
}));

// Импортируем моканые модули
import { prisma } from "../config/db";
import { getIo } from "../config/socket";

const mockPrisma = vi.mocked(prisma);
const mockGetIo = vi.mocked(getIo);
const mockGetBidsByAuctionId = vi.mocked(getBidsByAuctionId);
const mockGetBidsCountByAuctionId = vi.mocked(getBidsCountByAuctionId);

describe("Bids Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // createBid
  // ========================================
  describe("createBid", () => {
    const auctionId = 1;
    const userId = 2;
    const amount = 150;
    const futureDate = new Date(Date.now() + 3600000);

    const mockAuction = {
      id: auctionId,
      title: "Test Auction",
      currentPrice: new Prisma.Decimal(100),
      currency: "usd",
      sellerId: 3,
      status: "ACTIVE",
      endsAt: futureDate,
      seller: { id: 3, email: "seller@test.com", name: "Seller" },
      winner: null,
    };

    const mockBid = {
      id: 1,
      auctionId,
      userId,
      amount: new Prisma.Decimal(amount),
      createdAt: new Date(),
      user: { id: userId, email: "bidder@test.com", name: "Bidder" },
      auction: {
        id: auctionId,
        title: "Test Auction",
        currentPrice: new Prisma.Decimal(amount),
      },
    };

    it("должен успешно создать ставку", async () => {
      mockPrisma.$transaction.mockResolvedValue([mockAuction, mockBid]);

      const result = await bidsService.createBid(auctionId, userId, amount);

      // currency не передан, поэтому findUnique для проверки валюты не вызывается
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      expect(result.bid).toEqual(mockBid);
      expect(result.auction).toEqual(mockAuction);
    });

    it("должен отправить WebSocket уведомление при новой ставке", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ currency: "usd" });
      mockPrisma.$transaction.mockResolvedValue([mockAuction, mockBid]);

      await bidsService.createBid(auctionId, userId, amount);

      const mockTo = vi.fn().mockReturnValue({ emit: vi.fn() });
      mockGetIo.mockReturnValue({ to: mockTo } as any);

      expect(mockGetIo).toHaveBeenCalled();
    });

    it("должен выбросить ошибку, если валюта ставки не совпадает с валютой аукциона", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ currency: "eur" });

      await expect(
        bidsService.createBid(auctionId, userId, amount, "usd"),
      ).rejects.toThrow();
    });

    it("должен выбросить ошибку при P2025 (аукцион не найден или не активен)", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ currency: "usd" });
      const prismaError = new Error("Record not found") as Error & {
        code: string;
      };
      prismaError.code = "P2025";
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      await expect(
        bidsService.createBid(auctionId, userId, amount),
      ).rejects.toThrow("Невозможно сделать ставку");
    });

    it("должен пробросить ошибку, если это не P2025", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ currency: "usd" });
      mockPrisma.$transaction.mockRejectedValue(
        new Error("DB connection failed"),
      );

      await expect(
        bidsService.createBid(auctionId, userId, amount),
      ).rejects.toThrow("DB connection failed");
    });

    it("не должен проверять валюту, если currency не передан", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ currency: "usd" });
      mockPrisma.$transaction.mockResolvedValue([mockAuction, mockBid]);

      await bidsService.createBid(auctionId, userId, amount);

      // findUnique вызывается только для проверки валюты при наличии currency параметра
      // Но в коде он вызывается только если currency передан
      expect(mockPrisma.auction.findUnique).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // getBidsByAuction
  // ========================================
  describe("getBidsByAuction", () => {
    const auctionId = 1;

    it("должен вернуть список ставок с пагинацией", async () => {
      const mockBids = [
        {
          id: 1,
          auctionId,
          userId: 2,
          amount: new Prisma.Decimal(150),
          createdAt: new Date(),
          user: { id: 2, email: "user@test.com", name: "User" },
        },
      ];

      mockPrisma.auction.findUnique.mockResolvedValue({ id: auctionId });
      mockGetBidsByAuctionId.mockResolvedValue(mockBids as any);
      mockGetBidsCountByAuctionId.mockResolvedValue(1);

      const result = await bidsService.getBidsByAuction(auctionId, {
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.auction.findUnique).toHaveBeenCalledWith({
        where: { id: auctionId },
        select: { id: true },
      });
      expect(mockGetBidsByAuctionId).toHaveBeenCalledWith(
        mockPrisma,
        auctionId,
        0,
        10,
      );
      expect(result.bids).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("должен вернуть пустой массив, если ставок нет", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ id: auctionId });
      mockGetBidsByAuctionId.mockResolvedValue([]);
      mockGetBidsCountByAuctionId.mockResolvedValue(0);

      const result = await bidsService.getBidsByAuction(auctionId, {
        page: 1,
        limit: 10,
      });

      expect(result.bids).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it("должен выбросить 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      await expect(
        bidsService.getBidsByAuction(auctionId, { page: 1, limit: 10 }),
      ).rejects.toThrow("Аукцион не найден");
    });

    it("должен корректно рассчитать skip для второй страницы", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({ id: auctionId });
      mockGetBidsByAuctionId.mockResolvedValue([]);
      mockGetBidsCountByAuctionId.mockResolvedValue(0);

      await bidsService.getBidsByAuction(auctionId, { page: 3, limit: 5 });

      expect(mockGetBidsByAuctionId).toHaveBeenCalledWith(
        mockPrisma,
        auctionId,
        10,
        5,
      );
    });
  });
});
