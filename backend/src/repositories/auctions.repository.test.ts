import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import * as auctionsRepo from "./auctions.repository";

// Мокаем PrismaClient
const mockAuctionFindMany = vi.fn();
const mockAuctionFindUnique = vi.fn();
const mockAuctionCreate = vi.fn();
const mockAuctionUpdate = vi.fn();
const mockAuctionUpdateMany = vi.fn();
const mockAuctionDelete = vi.fn();
const mockAuctionDeleteMany = vi.fn();
const mockAuctionCount = vi.fn();

const mockPrisma = {
  auction: {
    findMany: mockAuctionFindMany,
    findUnique: mockAuctionFindUnique,
    create: mockAuctionCreate,
    update: mockAuctionUpdate,
    updateMany: mockAuctionUpdateMany,
    delete: mockAuctionDelete,
    deleteMany: mockAuctionDeleteMany,
    count: mockAuctionCount,
  },
} as any;

describe("Auctions Repository", () => {
  const futureDate = new Date(Date.now() + 3600000);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuctions", () => {
    it("должен вернуть список аукционов с пагинацией", async () => {
      const mockAuctions = [
        {
          id: 1,
          title: "Test Auction",
          startingPrice: new Prisma.Decimal(100),
          currentPrice: new Prisma.Decimal(150),
          status: "ACTIVE",
          endsAt: futureDate,
          sellerId: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockAuctionFindMany.mockResolvedValue(mockAuctions);

      const result = await auctionsRepo.getAuctions(mockPrisma, {}, 0, 10);

      expect(mockAuctionFindMany).toHaveBeenCalledWith({
        where: {},
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual(mockAuctions);
    });

    it("должен применить фильтры", async () => {
      mockAuctionFindMany.mockResolvedValue([]);

      await auctionsRepo.getAuctions(
        mockPrisma,
        { status: "ACTIVE", sellerId: 5 },
        0,
        10,
      );

      expect(mockAuctionFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ACTIVE", sellerId: 5 },
        }),
      );
    });
  });

  describe("getAuctionsCount", () => {
    it("должен вернуть количество аукционов", async () => {
      mockAuctionCount.mockResolvedValue(42);

      const result = await auctionsRepo.getAuctionsCount(mockPrisma, {
        status: "ACTIVE",
      });

      expect(mockAuctionCount).toHaveBeenCalledWith({
        where: { status: "ACTIVE" },
      });
      expect(result).toBe(42);
    });
  });

  describe("getAuctionById", () => {
    it("должен вернуть аукцион по ID с связанными данными", async () => {
      const mockAuction = {
        id: 1,
        title: "Test Auction",
        seller: { id: 1, email: "seller@test.com", name: "Seller" },
        winner: null,
        bids: [],
      };
      mockAuctionFindUnique.mockResolvedValue(mockAuction);

      const result = await auctionsRepo.getAuctionById(mockPrisma, 1);

      expect(mockAuctionFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          seller: {
            select: { id: true, email: true, name: true },
          },
          winner: {
            select: { id: true, email: true, name: true },
          },
          bids: {
            include: {
              user: {
                select: { id: true, email: true, name: true },
              },
            },
            orderBy: { amount: "desc" },
          },
        },
      });
      expect(result).toEqual(mockAuction);
    });

    it("должен вернуть null, если аукцион не найден", async () => {
      mockAuctionFindUnique.mockResolvedValue(null);

      const result = await auctionsRepo.getAuctionById(mockPrisma, 999);

      expect(result).toBeNull();
    });
  });

  describe("createAuction", () => {
    it("должен создать новый аукцион", async () => {
      const auctionData = {
        title: "New Auction",
        description: "Test Description",
        startingPrice: new Prisma.Decimal(100),
        currency: "usd",
        sellerId: 1,
        endsAt: futureDate,
      };
      const mockCreated = {
        id: 1,
        ...auctionData,
        currentPrice: new Prisma.Decimal(100),
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAuctionCreate.mockResolvedValue(mockCreated);

      const result = await auctionsRepo.createAuction(mockPrisma, auctionData);

      expect(mockAuctionCreate).toHaveBeenCalledWith({
        data: auctionData,
        include: expect.any(Object),
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe("updateAuctionById", () => {
    it("должен обновить аукцион", async () => {
      const mockUpdated = {
        id: 1,
        title: "Updated Title",
        sellerId: 1,
        status: "ACTIVE",
        seller: { id: 1, email: "seller@test.com", name: "Seller" },
      };
      mockAuctionUpdate.mockResolvedValue(mockUpdated);

      const result = await auctionsRepo.updateAuctionById(mockPrisma, 1, {
        title: "Updated Title",
      });

      expect(mockAuctionUpdate).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { title: "Updated Title" },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("updateAuctionMany", () => {
    it("должен обновить несколько аукционов", async () => {
      mockAuctionUpdateMany.mockResolvedValue({ count: 3 });
      const now = new Date();

      const result = await auctionsRepo.updateAuctionMany(
        mockPrisma,
        { status: "ACTIVE", endsAt: { lt: now } },
        { status: "COMPLETED" },
      );

      expect(mockAuctionUpdateMany).toHaveBeenCalledWith({
        where: { status: "ACTIVE", endsAt: { lt: now } },
        data: { status: "COMPLETED" },
      });
      expect(result).toEqual({ count: 3 });
    });
  });

  describe("deleteAuction", () => {
    it("должен удалить аукцион", async () => {
      mockAuctionDelete.mockResolvedValue({
        id: 1,
        title: "Deleted Auction",
      });

      const result = await auctionsRepo.deleteAuction(mockPrisma, 1);

      expect(mockAuctionDelete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({ id: 1, title: "Deleted Auction" });
    });
  });
});
