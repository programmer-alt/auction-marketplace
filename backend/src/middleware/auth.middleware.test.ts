import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import {
  parseAuthToken,
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from "./auth";
import { getJwtSecret } from "../config/jwt";
import { prisma } from "../config/db";

vi.mock("jsonwebtoken");
vi.mock("../config/jwt");
vi.mock("../config/db", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

const mockJwtVerify = vi.mocked(jwt.verify);
const mockGetJwtSecret = vi.mocked(getJwtSecret);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrismaUserFindUnique = vi.mocked((prisma as any).user.findUnique);

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJwtSecret.mockReturnValue("test-secret");
    mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 0 });
  });

  describe("parseAuthToken", () => {
    it("должен вернуть ошибку, если токен отсутствует", async () => {
      const result = await parseAuthToken(undefined);
      expect(result).toEqual({
        success: false,
        error: "No token provided",
      });
    });

    it("должен вернуть ошибку, если токен пустой", async () => {
      const result = await parseAuthToken("");
      expect(result).toEqual({
        success: false,
        error: "No token provided",
      });
    });

    it("должен успешно декодировать валидный токен", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      const result = await parseAuthToken("Bearer valid-token");
      expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", "test-secret");
      expect(mockPrismaUserFindUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { tokenVersion: true },
      });
      expect(result).toEqual({
        success: true,
        user: { id: 1, email: "test@example.com", role: "USER" },
      });
    });

    it("должен удалить префикс Bearer", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        tokenVersion: 0,
      });
      await parseAuthToken("Bearer token123");
      expect(mockJwtVerify).toHaveBeenCalledWith("token123", "test-secret");
    });

    it("должен обработать токен без префикса Bearer", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        tokenVersion: 0,
      });
      await parseAuthToken("token123");
      expect(mockJwtVerify).toHaveBeenCalledWith("token123", "test-secret");
    });

    it("должен вернуть ошибку, если tokenVersion не совпадает с текущим (отзыв токена)", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 1 });

      const result = await parseAuthToken("Bearer valid-token");
      expect(result).toEqual({
        success: false,
        error: "Token revoked",
      });
    });

    it("должен вернуть ошибку, если пользователь не найден (удалён)", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      mockPrismaUserFindUnique.mockResolvedValue(null);

      const result = await parseAuthToken("Bearer valid-token");
      expect(result).toEqual({
        success: false,
        error: "Token revoked",
      });
    });

    it("должен принять старый токен без tokenVersion (backward compatibility)", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
      } as Record<string, unknown>);
      mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 0 });

      const result = await parseAuthToken("Bearer old-token");
      expect(result).toEqual({
        success: true,
        user: { id: 1, email: "test@example.com", role: "USER" },
      });
    });

    it("должен вернуть ошибку, если токен невалиден", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const result = await parseAuthToken("Bearer invalid-token");
      expect(result).toEqual({
        success: false,
        error: "Invalid token",
      });
    });
  });

  describe("createAuthMiddleware", () => {
    it("должен установить req.user и вызвать next() при валидном токене", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      const middleware = createAuthMiddleware();
      const req = {
        headers: {
          authorization: "Bearer valid-token",
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect((req as any).user).toEqual({
        id: 1,
        email: "test@example.com",
        role: "USER",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен отсутствует", async () => {
      const middleware = createAuthMiddleware();
      const req = {
        headers: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен невалиден", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const middleware = createAuthMiddleware();
      const req = {
        headers: {
          authorization: "Bearer invalid-token",
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен отозван (tokenVersion mismatch)", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      mockPrismaUserFindUnique.mockResolvedValue({ tokenVersion: 1 });
      const middleware = createAuthMiddleware();
      const req = {
        headers: {
          authorization: "Bearer valid-token",
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Token revoked" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("createOptionalAuthMiddleware", () => {
    it("должен установить req.user и вызвать next() при валидном токене", async () => {
      mockJwtVerify.mockReturnValue({
        id: 1,
        email: "test@example.com",
        role: "USER",
        tokenVersion: 0,
      });
      const middleware = createOptionalAuthMiddleware();
      const req = {
        headers: {
          authorization: "Bearer valid-token",
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect((req as any).user).toEqual({
        id: 1,
        email: "test@example.com",
        role: "USER",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен просто вызвать next(), если токен отсутствует", async () => {
      const middleware = createOptionalAuthMiddleware();
      const req = {
        headers: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен есть, но невалиден", async () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const middleware = createOptionalAuthMiddleware();
      const req = {
        headers: {
          authorization: "Bearer invalid-token",
        },
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
