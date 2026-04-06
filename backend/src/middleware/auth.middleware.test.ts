import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import {
  parseAuthToken,
  createAuthMiddleware,
  createOptionalAuthMiddleware,
} from "./auth";
import { getJwtSecret } from "../config/jwt";

vi.mock("jsonwebtoken");
vi.mock("../config/jwt");

const mockJwtVerify = vi.mocked(jwt.verify);
const mockGetJwtSecret = vi.mocked(getJwtSecret);

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJwtSecret.mockReturnValue("test-secret");
  });

  describe("parseAuthToken", () => {
    it("должен вернуть ошибку, если токен отсутствует", () => {
      const result = parseAuthToken(undefined);
      expect(result).toEqual({
        success: false,
        error: "No token provided",
      });
    });

    it("должен вернуть ошибку, если токен пустой", () => {
      const result = parseAuthToken("");
      expect(result).toEqual({
        success: false,
        error: "No token provided",
      });
    });

    it("должен успешно декодировать валидный токен", () => {
      mockJwtVerify.mockImplementation(() => ({
        id: 1,
        email: "test@example.com",
        role: "USER",
      }));
      const result = parseAuthToken("Bearer valid-token");
      expect(mockJwtVerify).toHaveBeenCalledWith("valid-token", "test-secret");
      expect(result).toEqual({
        success: true,
        user: { id: 1, email: "test@example.com", role: "USER" },
      });
    });

    it("должен удалить префикс Bearer", () => {
      mockJwtVerify.mockImplementation(() => ({
        id: 1,
        email: "test@example.com",
      }));
      parseAuthToken("Bearer token123");
      expect(mockJwtVerify).toHaveBeenCalledWith("token123", "test-secret");
    });

    it("должен обработать токен без префикса Bearer", () => {
      mockJwtVerify.mockImplementation(() => ({
        id: 1,
        email: "test@example.com",
      }));
      parseAuthToken("token123");
      expect(mockJwtVerify).toHaveBeenCalledWith("token123", "test-secret");
    });

    it("должен вернуть ошибку, если токен невалиден", () => {
      mockJwtVerify.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      const result = parseAuthToken("Bearer invalid-token");
      expect(result).toEqual({
        success: false,
        error: "Invalid token",
      });
    });
  });

  describe("createAuthMiddleware", () => {
    it("должен установить req.user и вызвать next() при валидном токене", () => {
      mockJwtVerify.mockImplementation(() => ({
        id: 1,
        email: "test@example.com",
        role: "USER",
      }));
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

      middleware(req, res, next);

      expect((req as any).user).toEqual({
        id: 1,
        email: "test@example.com",
        role: "USER",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен отсутствует", () => {
      const middleware = createAuthMiddleware();
      const req = {
        headers: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен невалиден", () => {
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

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("createOptionalAuthMiddleware", () => {
    it("должен установить req.user и вызвать next() при валидном токене", () => {
      mockJwtVerify.mockImplementation(() => ({
        id: 1,
        email: "test@example.com",
        role: "USER",
      }));
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

      middleware(req, res, next);

      expect((req as any).user).toEqual({
        id: 1,
        email: "test@example.com",
        role: "USER",
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен просто вызвать next(), если токен отсутствует", () => {
      const middleware = createOptionalAuthMiddleware();
      const req = {
        headers: {},
      } as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn() as NextFunction;

      middleware(req, res, next);

      expect((req as any).user).toBeUndefined();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("должен вернуть 401, если токен есть, но невалиден", () => {
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

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
