import { AxiosError } from 'axios';
import { DetailedError, HandledError } from './advanced';

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
  return error && typeof error === 'object' && error.config?.handled === true;
}

/**
 * Type guard для проверки ошибки как AxiosError
 */
export function isAxiosError(error: any): error is AxiosError {
  return error && typeof error === 'object' && 'isAxiosError' in error;
}

/**
 * Type guard для проверки ошибки как стандартной Error
 */
export function isError(error: any): error is Error {
  return error && typeof error === 'object' && 'message' in error && 'name' in error;
}

/**
 * Type guard для проверки ошибки как DetailedError
 */
export function isDetailedError(error: any): error is DetailedError {
  return error && typeof error === 'object' && 'category' in error;
}

// ========================================
// Утилиты для обработки ошибок
// ========================================

/**
 * Функция для пометки ошибки как обработанной
 * Принимает конкретные типы ошибок для улучшенной типобезопасности
 */
export const markErrorAsHandled = (error: Error | AxiosError | DetailedError | HandledError): void => {
  if (!error) return;

  // Для ошибок с config (AxiosError расширяет Error с config)
  if ('config' in error && error.config !== undefined) {
    (error as HandledError).config = {
      ...(error as HandledError).config,
      handled: true
    };
    return;
  }

  // Для обычных ошибок добавляем config
  (error as HandledError).config = {
    handled: true
  };
};

/**
 * Функция для проверки, была ли ошибка уже обработана
 */
export const isErrorHandled = (error: any): boolean => {
  return isHandledError(error);
};
