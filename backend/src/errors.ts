// ========================================
// Фабрики ошибок (функциональный подход)
// ========================================

export type AppErrorType =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "INTERNAL";

export interface AppError extends Error {
  errorType: AppErrorType;
  statusCode: number;
}

// Фабрика для создания ошибки "Не найдено" (404)
export const createNotFoundError = (
  message: string = "Объект не найден",
): AppError => {
  const error = new Error(message) as AppError;
  error.name = "NotFoundError";
  error.errorType = "NOT_FOUND";
  error.statusCode = 404;
  return error;
};

// Фабрика для создания ошибки "Доступ запрещён" (403)
export const createForbiddenError = (
  message: string = "Недостаточно прав для выполнения операции",
): AppError => {
  const error = new Error(message) as AppError;
  error.name = "ForbiddenError";
  error.errorType = "FORBIDDEN";
  error.statusCode = 403;
  return error;
};

// Фабрика для создания ошибки "Валидация" (400)
export const createValidationError = (message: string): AppError => {
  const error = new Error(message) as AppError;
  error.name = "ValidationError";
  error.errorType = "VALIDATION";
  error.statusCode = 400;
  return error;
};

// ========================================
// Централизованный обработчик ошибок
// ========================================
export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  console.error("Ошибка:", err);

  // Обработка наших кастомных ошибок
  if (err?.errorType === "NOT_FOUND") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err?.errorType === "FORBIDDEN") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err?.errorType === "VALIDATION") {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Обработка Zod ошибок валидации
  if (err.name === "ZodError") {
    return res.status(400).json({ error: "Ошибка валидации: " + err.message });
  }

  // Обработка ошибок Prisma (запись не найдена)
  if (err.code === "P2025" || err.code === "P2001") {
    return res.status(404).json({ error: "Запрашиваемый объект не найден" });
  }

  // Все остальные ошибки — 500
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
};
