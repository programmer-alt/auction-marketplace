import { AppError } from "./types";

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
