import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { generateCsrfToken, verifyCsrfToken } from "./csrf";

describe("CSRF Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      method: "POST",
      cookies: {},
      path: "/api/test",
      headers: {},
    };
    mockRes = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  describe("generateCsrfToken", () => {
    it("должен вызвать next() для GET запроса без генерации токена", () => {
      mockReq.method = "GET";

      generateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it("должен вызвать next() для HEAD запроса", () => {
      mockReq.method = "HEAD";

      generateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it("должен вызвать next() для OPTIONS запроса", () => {
      mockReq.method = "OPTIONS";

      generateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it("должен сгенерировать новый токен, если cookie отсутствует", () => {
      mockReq.method = "POST";
      mockReq.cookies = {};

      generateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        "csrfToken",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          maxAge: 7200000,
        }),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("не должен перегенерировать токен, если валидный токен уже есть", () => {
      mockReq.method = "POST";
      // Сначала генерируем токен через саму функцию generateCsrfToken
      const tempRes = {
        cookie: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const tempReq = { method: "POST", cookies: {}, headers: {}, path: "/api/test" } as any;
      generateCsrfToken(tempReq, tempRes as any, () => {});
      const generatedToken = tempRes.cookie.mock.calls[0][1];

      // Теперь используем этот токен
      mockReq.cookies = { csrfToken: generatedToken };
      mockReq.headers = { "x-csrf-token": generatedToken };

      generateCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("verifyCsrfToken", () => {
    it("должен вызвать next() для GET запроса", () => {
      mockReq.method = "GET";

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("должен пропустить webhook маршруты", () => {
      mockReq.method = "POST";
      Object.defineProperty(mockReq, 'path', { value: '/api/payments/webhook', writable: true });

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("должен вернуть 403, если CSRF токен отсутствует в cookie", () => {
      mockReq.method = "POST";
      mockReq.cookies = {};
      mockReq.headers = {};

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "CSRF токен не найден",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("должен вернуть 403, если CSRF токен отсутствует в заголовке", () => {
      mockReq.method = "POST";
      mockReq.cookies = { csrfToken: "some.token" };
      mockReq.headers = {};

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "CSRF токен не найден",
      });
    });

    it("должен вернуть 403, если токены не совпадают", () => {
      mockReq.method = "POST";
      mockReq.cookies = { csrfToken: "token1" };
      mockReq.headers = { "x-csrf-token": "token2" };

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Неверный CSRF токен",
      });
    });

    it("должен вызвать next() при совпадении валидных токенов", () => {
      mockReq.method = "POST";
      // Генерируем реальный токен через generateCsrfToken
      const tempRes = {
        cookie: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const tempReq = {
        method: "POST",
        cookies: {},
        headers: {},
        path: "/api/test",
      } as any;
      generateCsrfToken(tempReq, tempRes as any, () => {});
      const generatedToken = tempRes.cookie.mock.calls[0][1];

      mockReq.cookies = { csrfToken: generatedToken };
      mockReq.headers = { "x-csrf-token": generatedToken };

      verifyCsrfToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
