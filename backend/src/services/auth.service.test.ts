import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as authService from "./auth.service";
import { getUserByEmail, createUser, getUserById } from "../repositories/users.repository";
import { getJwtSecret } from "../config/jwt";

// Мокаем модули
vi.mock("bcrypt");
vi.mock("jsonwebtoken");
vi.mock("../config/jwt");
vi.mock("../repositories/users.repository");
vi.mock("../config/db", () => ({
  prisma: {},
}));

const mockGetUserByEmail = vi.mocked(getUserByEmail);
const mockCreateUser = vi.mocked(createUser);
const mockGetUserById = vi.mocked(getUserById);
const mockBcryptHash = vi.mocked(bcrypt.hash);
const mockBcryptCompare = vi.mocked(bcrypt.compare);
const mockJwtSign = vi.mocked(jwt.sign);
const mockGetJwtSecret = vi.mocked(getJwtSecret);

describe("Auth Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJwtSecret.mockReturnValue("test-secret");
  });

  describe("register", () => {
    it("должен успешно зарегистрировать нового пользователя", async () => {
      // Пользователь не существует
      mockGetUserByEmail.mockResolvedValue(null);
      mockBcryptHash.mockResolvedValue("hashed-password" as never);
      mockCreateUser.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        balance: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockJwtSign.mockImplementation(() => "fake-jwt-token");

      const result = await authService.register("test@example.com", "password123", "Test User");

      expect(mockGetUserByEmail).toHaveBeenCalledWith({}, "test@example.com");
      expect(mockBcryptHash).toHaveBeenCalledWith("password123", 10);
      expect(mockCreateUser).toHaveBeenCalledWith({}, {
        email: "test@example.com",
        password: "hashed-password",
        name: "Test User",
      });
      expect(mockJwtSign).toHaveBeenCalledWith(
        { id: 1, email: "test@example.com" },
        "test-secret",
        { expiresIn: "7d" },
      );
      expect(result).toEqual({
        user: {
          id: 1,
          email: "test@example.com",
          name: "Test User",
        },
        token: "fake-jwt-token",
      });
    });

    it("должен выбросить ошибку, если пользователь уже существует", async () => {
      mockGetUserByEmail.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        name: "Existing User",
        password: "hashed",
        balance: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.register("test@example.com", "password123", "Test User"),
      ).rejects.toThrow("Пользователь уже существует");
    });

    it("должен регистрировать без имени (опционально)", async () => {
      mockGetUserByEmail.mockResolvedValue(null);
      mockBcryptHash.mockResolvedValue("hashed-password" as never);
      mockCreateUser.mockResolvedValue({
        id: 1,
        email: "test@example.com",
        name: null,
        password: "hashed-password",
        balance: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockJwtSign.mockImplementation(() => "fake-jwt-token");

      const result = await authService.register("test@example.com", "password123");

      expect(mockCreateUser).toHaveBeenCalledWith({}, {
        email: "test@example.com",
        password: "hashed-password",
        name: undefined,
      });
      expect(result.user.name).toBeNull();
    });
  });

  describe("login", () => {
    it("должен успешно войти с правильными учетными данными", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        balance: 100 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true as never);
      mockJwtSign.mockImplementation(() => "fake-jwt-token");

      const result = await authService.login("test@example.com", "password123");

      expect(mockGetUserByEmail).toHaveBeenCalledWith({}, "test@example.com");
      expect(mockBcryptCompare).toHaveBeenCalledWith("password123", "hashed-password");
      expect(mockJwtSign).toHaveBeenCalledWith(
        { id: 1, email: "test@example.com" },
        "test-secret",
        { expiresIn: "7d" },
      );
      expect(result).toEqual({
        user: {
          id: 1,
          email: "test@example.com",
          name: "Test User",
          balance: 100 as any,
        },
        token: "fake-jwt-token",
      });
    });

    it("должен выбросить ошибку, если пользователь не найден", async () => {
      mockGetUserByEmail.mockResolvedValue(null);

      await expect(
        authService.login("nonexistent@example.com", "password123"),
      ).rejects.toThrow("Неверные учетные данные");
    });

    it("должен выбросить ошибку, если пароль неверный", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed-password",
        balance: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false as never);

      await expect(
        authService.login("test@example.com", "wrongpassword"),
      ).rejects.toThrow("Неверные учетные данные");
    });
  });

  describe("getCurrentUser", () => {
    it("должен вернуть пользователя по ID", async () => {
      const mockUser = {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        password: "hashed",
        balance: 0 as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserById.mockResolvedValue(mockUser);

      const result = await authService.getCurrentUser(1);

      expect(mockGetUserById).toHaveBeenCalledWith({}, 1);
      expect(result).toEqual(mockUser);
    });
  });
});