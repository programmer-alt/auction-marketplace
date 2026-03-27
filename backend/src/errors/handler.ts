import { Request, Response, NextFunction } from "express";
import { AppError, ZodError, PrismaError } from "./error.types";
import { ApiError } from "../types";

// Тип для всех возможных ошибок
type ErrorHandlerError = Error | AppError | ZodError | PrismaError;

// Централизованный обработчик ошибок
export const errorHandler = (
  err: ErrorHandlerError,
  _req: Request,
  res: Response<ApiError>,
  _next: NextFunction
) => {
  console.error("Ошибка:", err);

  // Обработка наших кастомных ошибок
  if ("errorType" in err && err.errorType === "NOT_FOUND") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if ("errorType" in err && err.errorType === "FORBIDDEN") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if ("errorType" in err && err.errorType === "VALIDATION") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Обработка Zod ошибок валидации
  if ("name" in err && err.name === "ZodError") {
    return res.status(400).json({ error: "Ошибка валидации: " + err.message });
  }

  // Обработка ошибок Prisma (запись не найдена)
  if ("code" in err && (err.code === "P2025" || err.code === "P2001")) {
    return res.status(404).json({ error: "Запрашиваемый объект не найден" });
  }

  // Все остальные ошибки — 500
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
};
