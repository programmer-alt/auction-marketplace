import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Создаём моки Prisma и Io, которые будут использоваться в обоих моках
const { mockPrisma, mockIo } = vi.hoisted(() => {
  const mockPrisma = {
    auction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockIo = {
    emit: vi.fn(),
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
  };

  return { mockPrisma, mockIo };
});

// Мокаем модули ДО импорта роутеров
vi.mock("../index.js", () => ({
  prisma: mockPrisma,
  io: mockIo,
}));

// Мокаем config/db (чтобы перекрыть импорт prisma в сервисах)
vi.mock("../config/db.js", () => ({
  prisma: mockPrisma,
  pool: {},
  runWithRetry: (fn: () => Promise<any>) => fn(),
}));

// Мокаем socket.io config
vi.mock("../config/socket.js", () => ({
  getIo: vi.fn(() => mockIo),
}));

// Мокаем auth middleware
vi.mock("../middleware/auth.js", () => ({
  authMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    // Симулируем авторизованного пользователя
    req.user = { id: 1, email: "test@test.com" };
    next();
  }),
}));
import { errorHandler } from "../errors/handler";
import auctionsRouter from "./auctions.routes";

// Создаём тестовое Express приложение
const app = express();
app.use(express.json());
app.use("/api/auctions", auctionsRouter);
app.use(errorHandler);

describe("Auctions Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // GET /api/auctions — Получение списка аукционов
  // ========================================
  describe("GET /api/auctions", () => {
    const futureDate = "2027-12-31T23:59:59.000Z";

    it("должен вернуть пустой массив, если аукционов нет", async () => {
      mockPrisma.auction.findMany.mockResolvedValue([]);
      mockPrisma.auction.count.mockResolvedValue(0);

      const response = await request(app).get("/api/auctions");

      expect(response.status).toBe(200);
      expect(response.body.auctions).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it("должен вернуть список аукционов с пагинацией", async () => {
      const mockAuctions = [
        {
          id: 1,
          title: "Test Auction 1",
          description: "Description 1",
          imageUrl: "https://example.com/1.jpg",
          startingPrice: 100,
          currentPrice: 150,
          currency: "usd",
          sellerId: 1,
          status: "ACTIVE",
          endsAt: new Date(futureDate),
          createdAt: new Date(),
          updatedAt: new Date(),
          seller: { id: 1, email: "seller@test.com", name: "Seller" },
          winner: null,
          _count: { bids: 5 },
        },
      ];

      mockPrisma.auction.findMany.mockResolvedValue(mockAuctions);
      mockPrisma.auction.count.mockResolvedValue(1);

      const response = await request(app).get("/api/auctions?page=1&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.auctions).toHaveLength(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.total).toBe(1);
      expect(response.body.pagination.totalPages).toBe(1);
    });

    it("должен фильтровать по status", async () => {
      mockPrisma.auction.findMany.mockResolvedValue([]);
      mockPrisma.auction.count.mockResolvedValue(0);

      await request(app).get("/api/auctions?status=ACTIVE");

      expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });

    it("должен фильтровать по sellerId", async () => {
      mockPrisma.auction.findMany.mockResolvedValue([]);
      mockPrisma.auction.count.mockResolvedValue(0);

      await request(app).get("/api/auctions?sellerId=1");

      expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 1 }),
        }),
      );
    });

    it("должен корректно обрабатывать параметры пагинации", async () => {
      mockPrisma.auction.findMany.mockResolvedValue([]);
      mockPrisma.auction.count.mockResolvedValue(50);

      await request(app).get("/api/auctions?page=2&limit=5");

      expect(mockPrisma.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (2-1) * 5
          take: 5,
        }),
      );
    });
  });

  // ========================================
  // GET /api/auctions/:id — Получение аукциона по ID
  // ========================================
  describe("GET /api/auctions/:id", () => {
    const futureDate = "2027-12-31T23:59:59.000Z";
    it("должен вернуть аукцион по ID", async () => {
      const mockAuction = {
        id: 1,
        title: "Test Auction",
        description: "Test Description",
        imageUrl: "https://example.com/image.jpg",
        startingPrice: 100,
        currentPrice: 150,
        currency: "usd",
        sellerId: 1,
        winnerId: null,
        status: "ACTIVE",
        endsAt: new Date(futureDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        seller: { id: 1, email: "seller@test.com", name: "Seller" },
        winner: null,
        bids: [],
      };

      mockPrisma.auction.findUnique.mockResolvedValue(mockAuction);

      const response = await request(app).get("/api/auctions/1");

      expect(response.status).toBe(200);
      expect(response.body.auction.title).toBe("Test Auction");
      expect(mockPrisma.auction.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });
    });

    it("должен вернуть 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      const response = await request(app).get("/api/auctions/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Аукцион не найден");
    });

    it("должен вернуть 400 при невалидном ID", async () => {
      const response = await request(app).get("/api/auctions/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный ID аукциона");
    });

    it("должен включить ставки, отсортированные по убыванию", async () => {
      const mockAuction = {
        id: 1,
        title: "Test Auction",
        bids: [
          {
            id: 2,
            amount: 200,
            user: { id: 2, email: "user2@test.com", name: "User 2" },
          },
          {
            id: 1,
            amount: 150,
            user: { id: 1, email: "user1@test.com", name: "User 1" },
          },
        ],
      };

      mockPrisma.auction.findUnique.mockResolvedValue(mockAuction);

      await request(app).get("/api/auctions/1");

      expect(mockPrisma.auction.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            bids: expect.objectContaining({
              orderBy: { amount: "desc" },
            }),
          }),
        }),
      );
    });
  });

  // ========================================
  // POST /api/auctions — Создание аукциона
  // ========================================
  describe("POST /api/auctions", () => {
    // Дата в будущем (сейчас март 2026)
    const futureDate = "2027-12-31T23:59:59.000Z";

    const validAuctionData = {
      title: "New Auction",
      description: "Test Description",
      imageUrl: "https://example.com/image.jpg",
      startingPrice: 100,
      currency: "usd",
      endsAt: futureDate,
    };

    it("должен создать новый аукцион", async () => {
      const mockCreatedAuction = {
        id: 1,
        ...validAuctionData,
        currentPrice: 100,
        sellerId: 1,
        status: "ACTIVE",
        endsAt: new Date(futureDate),
        createdAt: new Date(),
        updatedAt: new Date(),
        seller: { id: 1, email: "test@test.com", name: null },
      };

      mockPrisma.auction.create.mockResolvedValue(mockCreatedAuction);

      const response = await request(app).post("/api/auctions").send(validAuctionData);

      // Отладка: вывести ошибку валидации
      if (response.status !== 201) {
        console.error("Ошибка валидации:", response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Аукцион успешно создан");
      expect(response.body.auction.title).toBe("New Auction");
      expect(mockPrisma.auction.create).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith("auction:new", expect.any(Object));
    });

    it("должен создать аукцион без необязательных полей", async () => {
      const minimalData = {
        title: "Minimal Auction",
        startingPrice: 50,
        endsAt: futureDate,
      };

      mockPrisma.auction.create.mockResolvedValue({ id: 1, ...minimalData });

      const response = await request(app).post("/api/auctions").send(minimalData);

      expect(response.status).toBe(201);
      expect(mockPrisma.auction.create).toHaveBeenCalled();
      const callArgs = mockPrisma.auction.create.mock.calls[0][0];
      expect(callArgs.data.title).toBe("Minimal Auction");
      expect(callArgs.data.startingPrice).toBeDefined();
      // startingPrice может быть Decimal объектом, проверяем его строковое представление
      expect(callArgs.data.startingPrice.toString()).toBe("50");
    });

    it("должен вернуть 400, если название пустое", async () => {
      const invalidData = {
        title: "",
        startingPrice: 100,
        endsAt: futureDate,
      };

      const response = await request(app).post("/api/auctions").send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeInstanceOf(Array);
    });

    it("должен вернуть 400, если startingPrice отрицательное", async () => {
      const invalidData = {
        title: "Test",
        startingPrice: -100,
        endsAt: futureDate,
      };

      const response = await request(app).post("/api/auctions").send(invalidData);

      expect(response.status).toBe(400);
    });

    it("должен вернуть 400, если дата окончания в прошлом", async () => {
      const invalidData = {
        title: "Test",
        startingPrice: 100,
        endsAt: "2020-01-01T00:00:00.000Z",
      };

      const response = await request(app).post("/api/auctions").send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Дата окончания должна быть в будущем");
    });

    it("должен вернуть 400 при невалидном URL изображения", async () => {
      const invalidData = {
        ...validAuctionData,
        imageUrl: "not-a-valid-url",
      };

      const response = await request(app).post("/api/auctions").send(invalidData);

      expect(response.status).toBe(400);
    });

    it("должен вернуть 401 без авторизации", async () => {
      // Переопределяем мок authMiddleware чтобы он не добавлял user
      const { authMiddleware } = await import("../middleware/auth.js");
      vi.mocked(authMiddleware).mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).post("/api/auctions").send(validAuctionData);

      expect(response.status).toBe(401);
    });

    it("должен использовать валюту по умолчанию usd", async () => {
      const dataWithoutCurrency = {
        title: "Test",
        startingPrice: 100,
        endsAt: futureDate,
      };

      mockPrisma.auction.create.mockResolvedValue({
        id: 1,
        ...dataWithoutCurrency,
      });

      await request(app).post("/api/auctions").send(dataWithoutCurrency);

      expect(mockPrisma.auction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: "usd",
          }),
        }),
      );
    });
  });

  // ========================================
  // PUT /api/auctions/:id — Обновление аукциона
  // ========================================
  describe("PUT /api/auctions/:id", () => {
    it("должен обновить аукцион", async () => {
      mockPrisma.auction.update.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        title: "Updated Title",
        seller: { id: 1, email: "test@test.com", name: null },
      });
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        title: "Updated Title",
        seller: { id: 1, email: "test@test.com", name: null },
      });

      const response = await request(app).put("/api/auctions/1").send({ title: "Updated Title" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Аукцион успешно обновлён");
      expect(response.body.auction.title).toBe("Updated Title");
    });

    it("должен вернуть 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      const response = await request(app).put("/api/auctions/999").send({ title: "Updated" });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Аукцион не найден");
    });

    it("должен вернуть 403, если пользователь не продавец", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 2, // Другой пользователь
      });

      const response = await request(app).put("/api/auctions/1").send({ title: "Updated" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Недостаточно прав для редактирования этого аукциона");
    });

    it("должен вернуть 400, если аукцион не активен", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "COMPLETED",
      });

      const response = await request(app).put("/api/auctions/1").send({ title: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Можно редактировать только активные аукционы");
    });

    it("должен вернуть 400 при невалидном ID", async () => {
      const response = await request(app).put("/api/auctions/invalid").send({ title: "Updated" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный ID аукциона");
    });

    it("должен вернуть 400, если новая дата окончания в прошлом", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
      });

      const response = await request(app).put("/api/auctions/1").send({ endsAt: "2020-01-01T00:00:00.000Z" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Дата окончания должна быть в будущем");
    });

    it("должен отправить WebSocket уведомление при обновлении", async () => {
      mockPrisma.auction.update.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        title: "Updated",
        seller: { id: 1, email: "test@test.com", name: null },
      });
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        title: "Updated",
        seller: { id: 1, email: "test@test.com", name: null },
      });

      await request(app).put("/api/auctions/1").send({ title: "Updated" });

      expect(mockIo.to).toHaveBeenCalledWith("auction:1");
      expect(mockIo.to("auction:1").emit).toHaveBeenCalledWith("auction:updated", expect.any(Object));
    });
  });

  // ========================================
  // DELETE /api/auctions/:id — Удаление аукциона
  // ========================================
  describe("DELETE /api/auctions/:id", () => {
    it("должен удалить аукцион", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
      });
      mockPrisma.auction.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app).delete("/api/auctions/1");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Аукцион успешно удалён");
      expect(mockPrisma.auction.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 1, sellerId: 1 }),
        }),
      );
    });

    it("должен вернуть 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);
      mockPrisma.auction.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app).delete("/api/auctions/999");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Аукцион не найден");
    });

    it("должен вернуть 403, если пользователь не продавец", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 2, // Другой пользователь
      });
      mockPrisma.auction.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app).delete("/api/auctions/1");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Недостаточно прав для удаления этого аукциона");
    });

    it("должен вернуть 400 при невалидном ID", async () => {
      const response = await request(app).delete("/api/auctions/invalid");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный ID аукциона");
    });

    it("должен отправить WebSocket уведомление при удалении", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
      });
      mockPrisma.auction.deleteMany.mockResolvedValue({ count: 1 });

      await request(app).delete("/api/auctions/1");

      expect(mockIo.to).toHaveBeenCalledWith("auction:1");
      expect(mockIo.to("auction:1").emit).toHaveBeenCalledWith("auction:deleted", { id: 1 });
    });
  });

  // ========================================
  // POST /api/auctions/:id/complete — завершение аукциона
  // ========================================
  describe("POST /api/auctions/:id/complete", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("должен завершить аукцион", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
      });
      mockPrisma.auction.update.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "COMPLETED",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
        title: "Test Auction",
        currentPrice: 100,
        seller: { id: 1, email: "test@test.com", name: null },
        winner: { id: 5, email: "buyer@test.com", name: "Buyer" },
        bids: [],
      });

      const response = await request(app).post("/api/auctions/1/complete");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Аукцион успешно завершён");
      expect(response.body.auction.status).toBe("COMPLETED");
    });

    it("должен вернуть 404, если аукцион не найден", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue(null);

      const response = await request(app).post("/api/auctions/999/complete");

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Аукцион не найден");
    });

    it("должен вернуть 403, если пользователь не продавец", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 2,
        status: "ACTIVE",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
      });

      const response = await request(app).post("/api/auctions/1/complete");

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Недостаточно прав для завершения этого аукциона");
    });

    it("должен вернуть 400, если аукцион уже завершён", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "COMPLETED",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
      });

      const response = await request(app).post("/api/auctions/1/complete");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Аукцион уже завершён или отменён");
    });

    it("должен вернуть 400, если время ещё не вышло", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        endsAt: new Date("2099-01-01"),
        winnerId: 5,
      });

      const response = await request(app).post("/api/auctions/1/complete");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Время аукциона ещё не вышло");
    });

    it("должен вернуть 400, если нет победителя", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        endsAt: new Date("2020-01-01"),
        winnerId: null,
      });

      const response = await request(app).post("/api/auctions/1/complete");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Нет победителя для завершения");
    });

    it("должен вернуть 400 при невалидном ID", async () => {
      const response = await request(app).post("/api/auctions/invalid/complete");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Некорректный ID аукциона");
    });

    it("должен отправить WebSocket уведомление при завершении", async () => {
      mockPrisma.auction.findUnique.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "ACTIVE",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
      });
      mockPrisma.auction.update.mockResolvedValue({
        id: 1,
        sellerId: 1,
        status: "COMPLETED",
        endsAt: new Date("2020-01-01"),
        winnerId: 5,
        title: "Test Auction",
        currentPrice: 100,
        seller: { id: 1, email: "test@test.com", name: null },
        winner: { id: 5, email: "buyer@test.com", name: "Buyer" },
        bids: [],
      });

      await request(app).post("/api/auctions/1/complete");

      expect(mockIo.to).toHaveBeenCalledWith("auction:1");
      expect(mockIo.to("auction:1").emit).toHaveBeenCalledWith("auction:completed", { id: 1, status: "COMPLETED" });
    });
  });
});
