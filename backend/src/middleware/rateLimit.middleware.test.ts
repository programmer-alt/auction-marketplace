import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rateLimit";

// Мокаем ioredis для тестов
vi.mock("ioredis", () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    incr: vi.fn(),
    connect: vi.fn(),
    on: vi.fn(),
    status: 'ready',
    quit: vi.fn(),
  };
  return {
    default: vi.fn(() => mockRedis),
  };
});

// Импортируем после мока
import { redis, safeRedis } from "../config/redis";

const mockRedisGet = vi.mocked(redis?.get || vi.fn());
const mockRedisSetex = vi.mocked(redis?.setex || vi.fn());
const mockRedisIncr = vi.mocked(redis?.incr || vi.fn());

describe("Rate Limit Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      socket: { remoteAddress: "192.168.1.1" },
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it("должен вызвать next() при первом запросе", async () => {
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue("OK" as any);

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining("rate_limit:"),
      60,
      "1",
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it("должен вызвать next() при запросе в пределах лимита", async () => {
    mockRedisGet.mockResolvedValue("50");
    mockRedisIncr.mockResolvedValue(51 as any);

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRedisIncr).toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });

  it("должен вернуть 429 при превышении лимита", async () => {
    mockRedisGet.mockResolvedValue("100");

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Слишком много запросов от этого IP-адреса.",
      message: expect.stringContaining("Превышен лимит запросов"),
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("должен использовать X-Forwarded-For для определения IP", async () => {
    mockReq.socket = { remoteAddress: "127.0.0.1" };
    mockReq.headers = { "x-forwarded-for": "10.0.0.5, 127.0.0.1" };
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue("OK" as any);

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining("10.0.0.5"),
      60,
      "1",
    );
  });

  it("должен нормализовать IPv4-mapped IPv6 адрес", async () => {
    mockReq.socket = { remoteAddress: "::ffff:192.168.1.1" };
    mockRedisGet.mockResolvedValue(null);
    mockRedisSetex.mockResolvedValue("OK" as any);

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining("192.168.1.1"),
      60,
      "1",
    );
  });

  it("должен вызвать next() при ошибке Redis (fallback на memory)", async () => {
    mockRedisGet.mockRejectedValue(new Error("Redis unavailable"));

    await rateLimit(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});