import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "../types";
import type { AppError, PrismaError, ZodError } from "./error.types";

// Тип для всех возможных ошибок
type ErrorHandlerError = Error | AppError | ZodError | PrismaError;

// Централизованный обработчик ошибок
export const errorHandler = (err: ErrorHandlerError, req: Request, res: Response<ApiError>, _next: NextFunction) => {
  // АГРЕССИВНОЕ логирование — пишем во ВСЕ потоки для отладки
  const errorInfo = {
    message: err.message,
    stack: err.stack,
    type: err.constructor.name,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    errorProperties: Object.keys(err),
  };

  // Пишем в stdout и stderr одновременно
  process.stderr.write(`[ERROR HANDLER] ${JSON.stringify(errorInfo)}\n`);
  process.stdout.write(`[DEBUG] Error caught: ${err.message}\n`);
  console.error("❌ Unhandled error:", err);
  if (err.stack) {
    console.error("📍 Stack:", err.stack);
  }

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
    const zodErr = err as import("zod").ZodError;
    return res.status(400).json({ error: zodErr.errors });
  }

  // Обработка ошибок Prisma (запись не найдена)
  if ("code" in err && (err.code === "P2025" || err.code === "P2001")) {
    return res.status(404).json({ error: "Запрашиваемый объект не найден" });
  }

  // Обработка ошибок подключения к БД
  if ("code" in err && err.code === "ECONNREFUSED") {
    console.error("Ошибка подключения к базе данных:", err.message);
    return res.status(503).json({ error: "Сервис базы данных недоступен" });
  }

  // В development — возвращаем полные детали
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) {
    return res.status(500).json({
      error: "Внутренняя ошибка сервера",
      message: err.message,
      stack: err.stack,
      path: req.path,
    });
  }

  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
};
