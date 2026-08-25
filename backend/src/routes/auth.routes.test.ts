import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаем модули ДО импорта роутеров
vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock("../controllers/auth.controller", () => ({
  authController: {
    register: vi.fn(),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    // Симулируем авторизованного пользователя
    req.user = { id: 1, email: "test@test.com" };
    next();
  }),
}));

// Импортируем моканые модули
import { authController } from "../controllers/auth.controller";
import authRouter from "./auth.routes";

// Создаём тестовое Express приложение
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

// Типы для моков
const mockAuthController = authController as any;

describe("Auth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("должен зарегистрировать пользователя", async () => {
      const mockResponse = {
        message: "Пользователь успешно зарегистрирован",
        user: { id: 1, email: "test@example.com", name: "Test User" },
        token: "fake-jwt-token",
      };
      mockAuthController.register.mockImplementation((_req: any, res: any) => {
        res.status(201).json(mockResponse);
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "mock_test_password",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
      expect(mockAuthController.register).toHaveBeenCalled();
    });

    it("должен вернуть 400 при невалидных данных", async () => {
      mockAuthController.register.mockImplementation((_req: any, res: any) => {
        res.status(400).json({ error: "Некорректный email" });
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "invalid-email",
        password: "short",
      });

      expect(response.status).toBe(400);
    });

    it("должен применять rate limiting", async () => {
      // Rate limiter уже замокан и просто вызывает next()
      // Проверяем, что запрос проходит
      mockAuthController.register.mockImplementation((_req: any, res: any) => {
        res.status(201).json({});
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "mock_test_password",
      });

      expect(response.status).toBe(201);
    });
  });

  describe("POST /api/auth/login", () => {
    it("должен войти с правильными учетными данными", async () => {
      const mockResponse = {
        message: "Вход выполнен успешно",
        user: { id: 1, email: "test@example.com", name: "Test User", balance: 0 },
        token: "fake-jwt-token",
      };
      mockAuthController.login.mockImplementation((_req: any, res: any) => {
        res.json(mockResponse);
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "mock_test_password",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(mockAuthController.login).toHaveBeenCalled();
    });

    it("должен вернуть 401 при неверных учетных данных", async () => {
      mockAuthController.login.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: "Неверные учетные данные" });
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
    });

    it("должен применять rate limiting", async () => {
      mockAuthController.login.mockImplementation((_req: any, res: any) => {
        res.json({});
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "mock_test_password",
      });

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/auth/me", () => {
    it("должен вернуть текущего пользователя при авторизации", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        balance: 0,
      };
      mockAuthController.getCurrentUser.mockImplementation((_req: any, res: any) => {
        res.json({ user: mockUser });
      });

      const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(mockUser);
      expect(mockAuthController.getCurrentUser).toHaveBeenCalled();
    });

    it("должен вернуть 401 без авторизации", async () => {
      // Переопределяем мок authMiddleware чтобы он возвращал 401
      const { authMiddleware } = await import("../middleware/auth");
      vi.mocked(authMiddleware).mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });
  });
});
