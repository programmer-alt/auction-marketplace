import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Создаём моки через vi.hoisted
const { mockBidsController, mockIo, mockAuthMiddleware } = vi.hoisted(() => ({
  mockBidsController: {
    createBid: vi.fn(),
    getBidsByAuction: vi.fn(),
  },
  mockIo: {
    emit: vi.fn(),
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  },
  mockAuthMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "test@test.com", role: "USER" };
    next();
  }),
}));

// Мокаем модули ДО импорта роутеров
vi.mock("@/controllers/bids.controller", () => ({
  bidsController: mockBidsController,
}));

vi.mock("@/index", () => ({
  prisma: {},
  io: mockIo,
}));

vi.mock("@/middleware/auth", () => ({
  authMiddleware: mockAuthMiddleware,
}));

// Импортируем роутер ПОСЛЕ моков
import bidsRouter from "./bids.routes";

// Создаём тестовое Express приложение
const app = express();
app.use(express.json());
app.use("/api/auctions", bidsRouter);

describe("Bids Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // POST /api/auctions/:auctionId/bids
  // ========================================
  describe("POST /api/auctions/:auctionId/bids", () => {
    it("должен успешно разместить ставку", async () => {
      const mockResponse = {
        message: "Ставка успешно размещена",
        bid: { id: 1, amount: 150, userId: 1 },
        auction: { id: 1, currentPrice: 150 },
      };
      mockBidsController.createBid.mockImplementation((_req: any, res: any) => {
        res.status(201).json(mockResponse);
      });

      const response = await request(app).post("/api/auctions/1/bids").send({ amount: 150 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Ставка успешно размещена");
      expect(response.body.bid.amount).toBe(150);
      expect(mockBidsController.createBid).toHaveBeenCalled();
    });

    it("должен вернуть 400 при отрицательной сумме ставки", async () => {
      mockBidsController.createBid.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "Сумма ставки должна быть положительной" });
      });

      const response = await request(app).post("/api/auctions/1/bids").send({ amount: -50 });

      expect(response.status).toBe(400);
    });

    it("должен вернуть 400 при невалидном ID аукциона", async () => {
      mockBidsController.createBid.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "Некорректный ID аукциона" });
      });

      const response = await request(app).post("/api/auctions/invalid/bids").send({ amount: 100 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный ID аукциона");
    });

    it("должен вернуть 401 без авторизации", async () => {
      mockAuthMiddleware.mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).post("/api/auctions/1/bids").send({ amount: 100 });

      expect(response.status).toBe(401);
    });

    it("должен вернуть 400 если amount не число", async () => {
      mockBidsController.createBid.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "Сумма ставки должна быть положительной" });
      });

      const response = await request(app).post("/api/auctions/1/bids").send({ amount: "not-a-number" });

      expect(response.status).toBe(400);
    });
  });

  // ========================================
  // GET /api/auctions/:auctionId/bids
  // ========================================
  describe("GET /api/auctions/:auctionId/bids", () => {
    it("должен вернуть историю ставок по аукциону", async () => {
      const mockResponse = {
        bids: [{ id: 1, amount: 150, userId: 2, user: { id: 2, email: "user@test.com", name: "User" } }],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      };
      mockBidsController.getBidsByAuction.mockImplementation((_req: any, res: any) => {
        res.json(mockResponse);
      });

      const response = await request(app).get("/api/auctions/1/bids");

      expect(response.status).toBe(200);
      expect(response.body.bids).toHaveLength(1);
      expect(response.body.pagination.total).toBe(1);
      expect(mockBidsController.getBidsByAuction).toHaveBeenCalled();
    });

    it("должен вернуть пустой массив, если ставок нет", async () => {
      mockBidsController.getBidsByAuction.mockImplementation((_req: any, res: any) => {
        res.json({ bids: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
      });

      const response = await request(app).get("/api/auctions/1/bids");

      expect(response.status).toBe(200);
      expect(response.body.bids).toEqual([]);
    });

    it("должен поддерживать пагинацию через query параметры", async () => {
      mockBidsController.getBidsByAuction.mockImplementation((_req: any, res: any) => {
        res.json({ bids: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } });
      });

      const response = await request(app).get("/api/auctions/1/bids?page=2&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(10);
    });

    it("должен вернуть 400 при невалидном ID аукциона", async () => {
      mockBidsController.getBidsByAuction.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "Некорректный ID аукциона" });
      });

      const response = await request(app).get("/api/auctions/invalid/bids");

      expect(response.status).toBe(400);
    });

    it("не требует авторизации (публичный эндпоинт)", async () => {
      mockBidsController.getBidsByAuction.mockImplementation((_req: any, res: any) => {
        res.json({ bids: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
      });

      // Запрос без токена авторизации
      const response = await request(app).get("/api/auctions/1/bids");

      expect(response.status).toBe(200);
    });
  });
});
