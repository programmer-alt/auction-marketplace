import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import * as bidsRepo from "./bids.repository";

// Мокаем PrismaClient
const mockBidCreate = vi.fn();
const mockBidFindMany = vi.fn();
const mockBidCount = vi.fn();
const mockBidFindUnique = vi.fn();
const mockBidDelete = vi.fn();

const mockPrisma = {
  bid: {
    create: mockBidCreate,
    findMany: mockBidFindMany,
    count: mockBidCount,
    findUnique: mockBidFindUnique,
    delete: mockBidDelete,
  },
} as any;

describe("Bids Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBid", () => {
    it("должен создать новую ставку", async () => {
      const bidData = {
        auctionId: 1,
        userId: 2,
        amount: new Prisma.Decimal(150),
      };
      const mockCreated = {
        id: 1,
        ...bidData,
        createdAt: new Date(),
        user: { id: 2, email: "bidder@test.com", name: "Bidder" },
        auction: { id: 1, title: "Test Auction", currentPrice: new Prisma.Decimal(150) },
      };
      mockBidCreate.mockResolvedValue(mockCreated);

      const result = await bidsRepo.createBid(mockPrisma, bidData);

      expect(mockBidCreate).toHaveBeenCalledWith({
        data: bidData,
        include: expect.objectContaining({
          user: expect.any(Object),
          auction: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe("getBidsByAuctionId", () => {
    it("должен вернуть ставки по аукциону с пагинацией", async () => {
      const mockBids = [
        {
          id: 1,
          auctionId: 1,
          userId: 2,
          amount: new Prisma.Decimal(150),
          createdAt: new Date(),
          user: { id: 2, email: "bidder@test.com", name: "Bidder" },
          auction: { id: 1, title: "Test Auction", currentPrice: new Prisma.Decimal(150) },
        },
      ];
      mockBidFindMany.mockResolvedValue(mockBids);

      const result = await bidsRepo.getBidsByAuctionId(mockPrisma, 1, 0, 10);

      expect(mockBidFindMany).toHaveBeenCalledWith({
        where: { auctionId: 1 },
        include: expect.objectContaining({
          user: expect.any(Object),
          auction: expect.any(Object),
        }),
        orderBy: { amount: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockBids);
    });

    it("должен вернуть пустой массив, если ставок нет", async () => {
      mockBidFindMany.mockResolvedValue([]);

      const result = await bidsRepo.getBidsByAuctionId(mockPrisma, 1, 0, 10);

      expect(result).toEqual([]);
    });
  });

  describe("getBidsCountByAuctionId", () => {
    it("должен вернуть количество ставок", async () => {
      mockBidCount.mockResolvedValue(15);

      const result = await bidsRepo.getBidsCountByAuctionId(mockPrisma, 1);

      expect(mockBidCount).toHaveBeenCalledWith({ where: { auctionId: 1 } });
      expect(result).toBe(15);
    });
  });

  describe("getBidById", () => {
    it("должен вернуть ставку по ID", async () => {
      const mockBid = {
        id: 1,
        auctionId: 1,
        userId: 2,
        amount: new Prisma.Decimal(150),
        createdAt: new Date(),
        user: { id: 2, email: "bidder@test.com", name: "Bidder" },
        auction: { id: 1, title: "Test Auction", currentPrice: new Prisma.Decimal(150) },
      };
      mockBidFindUnique.mockResolvedValue(mockBid);

      const result = await bidsRepo.getBidById(mockPrisma, 1);

      expect(mockBidFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          user: expect.any(Object),
          auction: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockBid);
    });

    it("должен вернуть null, если ставка не найдена", async () => {
      mockBidFindUnique.mockResolvedValue(null);

      const result = await bidsRepo.getBidById(mockPrisma, 999);

      expect(result).toBeNull();
    });
  });

  describe("deleteBid", () => {
    it("должен удалить ставку", async () => {
      const mockDeleted = {
        id: 1,
        auctionId: 1,
        userId: 2,
        amount: new Prisma.Decimal(150),
        createdAt: new Date(),
      };
      mockBidDelete.mockResolvedValue(mockDeleted);

      const result = await bidsRepo.deleteBid(mockPrisma, 1);

      expect(mockBidDelete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockDeleted);
    });
  });
});
