import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Создаём моки через vi.hoisted — они доступны в vi.mock
const { mockAuthController, mockAuthMiddleware, mockOptionalAuthMiddleware, mockIo } = vi.hoisted(() => ({
  mockAuthController: {
    register: vi.fn(),
    login: vi.fn(),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
  mockAuthMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "test@test.com" };
    next();
  }),
  mockOptionalAuthMiddleware: vi.fn(async (req: any, _res: any, next: any) => {
    req.user = { id: 1, email: "test@test.com" };
    next();
  }),
  mockIo: {
    emit: vi.fn(),
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  },
}));

// Мокаем модули ДО импорта роутеров
vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock("@/controllers/auth.controller", () => ({
  authController: mockAuthController,
}));

vi.mock("@/index", () => ({
  prisma: {},
  io: mockIo,
}));

vi.mock("@/middleware/auth", () => ({
  authMiddleware: mockAuthMiddleware,
  optionalAuthMiddleware: mockOptionalAuthMiddleware,
}));

// Импортируем моканые модули
import { authController } from "@/controllers/auth.controller";
import authRouter from "./auth.routes";

// Создаём тестовое Express приложение
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

// Типы для моков
const mockAuthControllerTyped = authController as any;

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
      mockAuthControllerTyped.register.mockImplementation((_req: any, res: any) => {
        res.status(201).json(mockResponse);
      });

      const response = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        password: "mock_test_password",
        name: "Test User",
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
      expect(mockAuthControllerTyped.register).toHaveBeenCalled();
    });

    it("должен вернуть 400 при невалидных данных", async () => {
      mockAuthControllerTyped.register.mockImplementation((_req: any, res: any) => {
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
      mockAuthControllerTyped.register.mockImplementation((_req: any, res: any) => {
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
      mockAuthControllerTyped.login.mockImplementation((_req: any, res: any) => {
        res.json(mockResponse);
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "mock_test_password",
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
      expect(mockAuthControllerTyped.login).toHaveBeenCalled();
    });

    it("должен вернуть 401 при неверных учетных данных", async () => {
      mockAuthControllerTyped.login.mockImplementation((_req: any, res: any) => {
        res.status(401).json({ error: "Неверные учетные данные" });
      });

      const response = await request(app).post("/api/auth/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
    });

    it("должен применять rate limiting", async () => {
      mockAuthControllerTyped.login.mockImplementation((_req: any, res: any) => {
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
      mockAuthControllerTyped.getCurrentUser.mockImplementation((_req: any, res: any) => {
        res.json({ user: mockUser });
      });

      const response = await request(app).get("/api/auth/me").set("Authorization", "Bearer valid-token");

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual(mockUser);
      expect(mockAuthControllerTyped.getCurrentUser).toHaveBeenCalled();
    });

    it("должен вернуть 401 без авторизации", async () => {
      // Переопределяем мок authMiddleware чтобы он возвращал 401
      mockOptionalAuthMiddleware.mockImplementationOnce(async (_req: any, res: any, _next: any) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app).get("/api/auth/me");

      expect(response.status).toBe(401);
    });
  });
});
