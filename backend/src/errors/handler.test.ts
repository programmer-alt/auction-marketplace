import { describe, it, expect, vi, beforeEach } from "vitest";
import { errorHandler } from "./handler";
import { createNotFoundError, createForbiddenError, createValidationError } from "./factories";

describe("Error Handler", () => {
  let mockRes: any;

  beforeEach(() => {
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it("должен обработать NotFoundError (404)", () => {
    const error = createNotFoundError("Аукцион не найден");

    errorHandler(error, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Аукцион не найден" });
  });

  it("должен обработать ForbiddenError (403)", () => {
    const error = createForbiddenError("Недостаточно прав");

    errorHandler(error, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Недостаточно прав" });
  });

  it("должен обработать ValidationError (400)", () => {
    const error = createValidationError("Неверные данные");

    errorHandler(error, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Неверные данные" });
  });

  it("должен обработать ZodError (400) с массивом ошибок", () => {
    const zodError = new Error("Zod validation failed") as any;
    zodError.name = "ZodError";
    zodError.errors = [
      { path: ["email"], message: "Invalid email" },
      { path: ["password"], message: "Password too short" },
    ];

    errorHandler(zodError, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({ error: zodError.errors });
  });

  it("должен обработать Prisma ошибку P2025 (404)", () => {
    const prismaError = new Error("Record not found") as any;
    prismaError.code = "P2025";

    errorHandler(prismaError, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Запрашиваемый объект не найден" });
  });

  it("должен обработать Prisma ошибку P2001 (404)", () => {
    const prismaError = new Error("Record not found") as any;
    prismaError.code = "P2001";

    errorHandler(prismaError, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Запрашиваемый объект не найден" });
  });

  it("должен вернуть 500 для неизвестных ошибок", () => {
    const unknownError = new Error("Something went wrong");

    errorHandler(unknownError, {} as any, mockRes, vi.fn());

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({ error: "Внутренняя ошибка сервера" });
  });

  it("должен залогировать ошибку в консоль", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const unknownError = new Error("Test error");

    errorHandler(unknownError, {} as any, mockRes, vi.fn());

    expect(consoleErrorSpy).toHaveBeenCalledWith("Ошибка:", unknownError);
    consoleErrorSpy.mockRestore();
  });
});
