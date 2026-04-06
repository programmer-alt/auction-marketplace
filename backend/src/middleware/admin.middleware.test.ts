import { describe, it, expect, vi, beforeEach } from "vitest";
import { Response, NextFunction } from "express";
import { adminMiddleware } from "./admin";

describe("Admin Middleware", () => {
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  it("должен вызвать next(), если роль ADMIN", () => {
    const req = {
      user: { id: 1, email: "admin@test.com", role: "ADMIN" },
    } as any;

    adminMiddleware(req, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("должен вернуть 403, если роль USER", () => {
    const req = {
      user: { id: 2, email: "user@test.com", role: "USER" },
    } as any;

    adminMiddleware(req, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Недостаточно прав" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("должен вернуть 403, если req.user отсутствует", () => {
    const req = {
      user: undefined,
    } as any;

    adminMiddleware(req, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Недостаточно прав" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("должен вернуть 403, если role не определён", () => {
    const req = {
      user: { id: 3, email: "norole@test.com" },
    } as any;

    adminMiddleware(req, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Недостаточно прав" });
  });
});
