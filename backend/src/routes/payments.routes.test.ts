import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаем контроллер
vi.mock("../controllers/payments.controller", () => ({
  paymentsController: {
    createPaymentIntent: vi.fn(),
    handleWebhook: vi.fn(),
    getPaymentHistory: vi.fn(),
  },
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "test@test.com", role: "USER" };
    next();
  }),
}));

import { paymentsController } from "../controllers/payments.controller";
import paymentsRouter from "./payments.routes";

const app = express();
// Для webhook нужен raw body parser
app.use(express.json());
app.use("/api/payments", paymentsRouter);

const mockPaymentsController = paymentsController as any;

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
      mockPaymentsController.createPaymentIntent.mockImplementation((_req: any, res: any) => {
        res.status(201).json(mockResponse);
      });

      const response = await request(app).post("/api/payments/create-intent").send({ auctionId: 1 });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("Платёжный интент создан");
      expect(response.body.clientSecret).toBe("pi_test_secret");
    });

    it("должен вернуть 400 при невалидном auctionId", async () => {
      mockPaymentsController.createPaymentIntent.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "ID аукциона должен быть положительным" });
      });

      const response = await request(app).post("/api/payments/create-intent").send({ auctionId: -1 });

      expect(response.status).toBe(400);
    });

    it("должен вернуть 401 без авторизации", async () => {
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
      mockPaymentsController.handleWebhook.mockImplementation((_req: any, res: any) => {
        res.json({ received: true });
      });

      const response = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("stripe-signature", "sig_test")
        .send(JSON.stringify({ type: "payment_intent.succeeded" }));

      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
    });

    it("должен вернуть 400 при ошибке обработки webhook", async () => {
      mockPaymentsController.handleWebhook.mockImplementation((_req: any, res: any) => {
        res.status(400).send("Webhook Error: Invalid signature");
      });

      const response = await request(app).post("/api/payments/webhook").set("stripe-signature", "bad_sig").send("{}");

      expect(response.status).toBe(400);
      expect(response.text).toContain("Webhook Error");
    });

    it("не требует авторизации (публичный эндпоинт для Stripe)", async () => {
      mockPaymentsController.handleWebhook.mockImplementation((_req: any, res: any) => {
        res.json({ received: true });
      });

      const response = await request(app).post("/api/payments/webhook").send("{}");

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // GET /api/payments/history
  // ========================================
  describe("GET /api/payments/history", () => {
    it("должен вернуть историю платежей", async () => {
      const mockResponse = {
        payments: [{ id: 1, amount: 500, status: "COMPLETED" }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockPaymentsController.getPaymentHistory.mockImplementation((_req: any, res: any) => {
        res.json(mockResponse);
      });

      const response = await request(app).get("/api/payments/history");

      expect(response.status).toBe(200);
      expect(response.body.payments).toHaveLength(1);
    });

    it("должен поддерживать пагинацию", async () => {
      mockPaymentsController.getPaymentHistory.mockImplementation((_req: any, res: any) => {
        res.json({
          payments: [],
          pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
        });
      });

      const response = await request(app).get("/api/payments/history?page=2&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
    });

    it("должен вернуть 401 без авторизации", async () => {
      const { authMiddleware } = await import("../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).get("/api/payments/history");

      expect(response.status).toBe(401);
    });
  });
});
