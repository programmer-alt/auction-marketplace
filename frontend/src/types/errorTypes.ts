import type { AxiosError } from "axios";
import { DetailedError, HandledError } from "./error.types";

// ========================================
// Типы для обработки ошибок
// ========================================

/**
 * Объединённый тип для всех возможных ошибок в приложении
 */
export type PossibleError = Error | AxiosError | DetailedError | string | null | undefined;

// ========================================
// Type Guards для проверки типов ошибок
// ========================================

/**
 * Type guard для проверки ошибки как HandledError
 */
export function isHandledError(error: any): error is HandledError {
  return error && typeof error === "object" && error.config?.handled === true;
}

/**
 * Type guard для проверки ошибки как AxiosError
 */
export function isAxiosError(error: any): error is AxiosError {
  return error && typeof error === "object" && "isAxiosError" in error;
}

/**
 * Type guard для проверки ошибки как стандартной Error
 */
export function isError(error: any): error is Error {
  return error instanceof Error || (error && typeof error.message === 'string');

/**
 * Type guard для проверки ошибки как DetailedError
 */
export function isDetailedError(error: any): error is DetailedError {
  return error && typeof error === "object" && "category" in error;
}

// ========================================
// Утилиты для обработки ошибок
// ========================================

/**
 * Функция для пометки ошибки как обработанной
 * Принимает конкретные типы ошибок для улучшенной типобезопасности
 */
export function markErrorAsHandled(error: Error | AxiosError | DetailedError | HandledError): void {
  if (isHandledError(error)) {
    return;
  }
  
  if (error && typeof error === 'object') {
    if (!error.config) {
      (error as any).config = {};
    }
    (error as any).config.handled = true;
  }
}

/**
 * Функция для проверки, была ли ошибка уже обработана
 */
export const isErrorHandled = (error: any): boolean => {
  return isHandledError(error);
};
