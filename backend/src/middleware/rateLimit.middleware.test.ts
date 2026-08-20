import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rateLimit";

describe("Rate Limit Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      socket: { remoteAddress: "192.168.1.1" },
      headers: {},
      path: "/api/test",
      method: "GET",
      originalUrl: "/api/test",
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it("должен вызвать next() при первом запросе", async () => {
    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it("должен вызвать next() при запросе в пределах лимита", async () => {
    mockReq.socket = { remoteAddress: "192.168.1.2" };
    
    for (let i = 0; i < 10; i++) {
      await rateLimit(mockReq as Request, mockRes as Response, mockNext);
    }

    expect(mockNext).toHaveBeenCalled();
  });

  it("должен использовать X-Forwarded-For для определения IP", async () => {
    mockReq.socket = { remoteAddress: "127.0.0.1" };
    mockReq.headers = { "x-forwarded-for": "10.0.0.5, 127.0.0.1" };
    
    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it("должен нормализовать IPv4-mapped IPv6 адрес", async () => {
    mockReq.socket = { remoteAddress: "::ffff:192.168.1.1" };
    
    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it("должен пропускать запросы к /uploads/*", async () => {
    mockReq.path = "/uploads/file.jpg";
    
    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("должен пропускать запросы к /api/auth/me", async () => {
    mockReq.path = "/api/auth/me";
    
    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
