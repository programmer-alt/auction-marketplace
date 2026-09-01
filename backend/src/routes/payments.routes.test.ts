import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../errors/handler";

// ========================================
// Mock payments.service — webhook вызывает реальный сервис,
// поэтому мокаем контроллер бесполезно для webhook-тестов
// ========================================
const { mockHandleWebhook, mockCreatePaymentIntent, mockGetPaymentHistory, mockRefundPayment, mockGetMyPayments } =
  vi.hoisted(() => ({
    mockHandleWebhook: vi.fn(),
    mockCreatePaymentIntent: vi.fn(),
    mockGetPaymentHistory: vi.fn(),
    mockRefundPayment: vi.fn(),
    mockGetMyPayments: vi.fn(),
  }));

vi.mock("../services/payments.service", () => ({
  createPaymentIntent: mockCreatePaymentIntent,
  handleWebhook: mockHandleWebhook,
  getPaymentHistory: mockGetPaymentHistory,
  refundPayment: mockRefundPayment,
  getMyPayments: mockGetMyPayments,
}));

// ========================================
// Auth middleware — мокаем относительным путём,
// так как payments.routes.ts импортирует из "../middleware/auth"
// ========================================
vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "test@test.com", role: "USER" };
    next();
  }),
}));

vi.mock("../middleware/admin", () => ({
  adminMiddleware: vi.fn(async (_req: any, _res: any, next: any) => next()),
}));

vi.mock("../config/db", () => ({
  prisma: {},
}));

// Импортируем роутер ПОСЛЕ моков
import paymentsRouter from "./payments.routes";

const app = express();
app.use(express.json());
app.use("/api/payments", paymentsRouter);
app.use(errorHandler);

describe("Payments Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // POST /api/payments/create-intent
  // ========================================
  describe("POST /api/payments/create-intent", () => {
    it("должен создать Payment Intent", async () => {
      const mockResponse = {
        message: "Платёжный интент создан",
        clientSecret: "pi_test_secret",
        payment: { id: 1, status: "PENDING" },
      };
      mockCreatePaymentIntent.mockResolvedValue(mockResponse);

      const response = await request(app).post("/api/payments/create-intent").send({ auctionId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Платёжный интент создан");
      expect(response.body.clientSecret).toBe("pi_test_secret");
    });

    it("должен вернуть 400 при невалидном auctionId", async () => {
      mockCreatePaymentIntent.mockRejectedValue(new Error("ID аукциона должен быть положительным"));

      const response = await request(app).post("/api/payments/create-intent").send({ auctionId: -1 });

      expect(response.status).toBe(400);
    });

    it("должен вернуть 401 без авторизации", async () => {
      // Переопределяем authMiddleware для этого теста
      const { authMiddleware } = await import("../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).post("/api/payments/create-intent").send({ auctionId: 1 });

      expect(response.status).toBe(401);
    });
  });

  // ========================================
  // POST /api/payments/webhook
  // ========================================
  describe("POST /api/payments/webhook", () => {
    it("должен обработать webhook успешно", async () => {
      mockHandleWebhook.mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "sig_test")
        .send(JSON.stringify({ type: "payment_intent.succeeded" }));

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it("должен вернуть 400 при ошибке обработки webhook", async () => {
      mockHandleWebhook.mockRejectedValue(new Error("Webhook Error: Invalid signature"));

      const response = await request(app).post("/api/payments/webhook").set("stripe-signature", "bad_sig").send("{}");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook processing failed");
    });

    it("не требует авторизации (публичный эндпоинт для Stripe)", async () => {
      mockHandleWebhook.mockResolvedValue(undefined);

      const response = await request(app).post("/api/payments/webhook").set("stripe-signature", "sig_test").send("{}");

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // GET /api/payments/my
  // ========================================
  describe("GET /api/payments/my", () => {
    it("должен вернуть историю платежей", async () => {
      const mockResponse = {
        payments: [{ id: 1, amount: 500, status: "COMPLETED" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockGetPaymentHistory.mockResolvedValue(mockResponse);

      const response = await request(app).get("/api/payments/my");

      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(1);
    });

    it("должен поддерживать пагинацию", async () => {
      mockGetPaymentHistory.mockResolvedValue({
        payments: [],
        pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      const response = await request(app).get("/api/payments/my?page=2&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
    });

    it("должен вернуть 401 без авторизации", async () => {
      const { authMiddleware } = await import("../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).get("/api/payments/my");

      expect(response.status).toBe(401);
    });
  });
});
