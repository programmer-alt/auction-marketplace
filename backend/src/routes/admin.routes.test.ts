import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Мокаем контроллер
vi.mock("../controllers/admin.controller", () => ({
  getQueueStats: vi.fn(),
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "admin@test.com", role: "ADMIN" };
    next();
  }),
}));

vi.mock("../middleware/admin", () => ({
  adminMiddleware: vi.fn((req: any, res: any, next: any) => {
    next();
  }),
}));

import { getQueueStats } from "../controllers/admin.controller";
import adminRouter from "./admin.routes";

const app = express();
app.use(express.json());
app.use("/api/admin", adminRouter);

const mockGetQueueStats = vi.mocked(getQueueStats);

describe("Admin Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // GET /api/admin/queue/stats
  // ========================================
  describe("GET /api/admin/queue/stats", () => {
    it("должен вернуть статистику очереди", async () => {
      const mockStats = {
        queue: "auctionCompletion",
        stats: {
          waiting: 2,
          active: 1,
          delayed: 5,
          completed: 10,
          failed: 0,
        },
        timestamp: "2026-04-05T12:00:00.000Z",
        note: "Queue disabled — Bull removed. Auction completion not yet implemented.",
      };
      mockGetQueueStats.mockImplementation(async (req: any, res: any) => {
        res.json(mockStats);
      });

      const response = await request(app).get("/api/admin/queue/stats");

      expect(response.status).toBe(200);
      expect(response.body.queue).toBe("auctionCompletion");
      expect(response.body.note).toBeDefined();
      expect(response.body.stats.delayed).toBe(5);
    });

    it("должен вернуть 401 без авторизации", async () => {
      const { authMiddleware } = await import("../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(
        async (_req: any, res: any, _next: any) => {
          res.status(401).json({ error: "Unauthorized" });
        },
      );

      const response = await request(app).get("/api/admin/queue/stats");

      expect(response.status).toBe(401);
    });

    it("должен вернуть 403 без роли ADMIN", async () => {
      const { adminMiddleware } = await import("../middleware/admin");
      vi.mocked(adminMiddleware).mockImplementationOnce(
        (req: any, res: any, _next: any) => {
          res.status(403).json({ error: "Недостаточно прав" });
        },
      );

      const response = await request(app).get("/api/admin/queue/stats");

      expect(response.status).toBe(403);
    });
  });
});
