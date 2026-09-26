/**
 * Error handling types
 */

import type { AxiosError } from "axios";

/**
 * Категории ошибок для классификации
 */
export enum ErrorCategory {
  NETWORK = "NETWORK",
  VALIDATION = "VALIDATION",
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  BUSINESS_LOGIC = "BUSINESS_LOGIC",
  SERVER_ERROR = "SERVER_ERROR",
  UNKNOWN = "UNKNOWN",
}

/**
 * Определяем контракт ошибки для унификации обработки
 */
export interface ErrorContract {
  message: string;
  level: "info" | "warning" | "error" | "critical";
  context?: Record<string, any>;
  handled?: boolean;
  timestamp?: Date;
}

/**
 * Интерфейс для детализации ошибки
 */
export interface DetailedError extends ErrorContract {
  code?: string;
  category: ErrorCategory;
  originalError?: any;
}

/**
 * Интерфейс для пометки ошибок как обработанных
 */
export interface HandledError extends Error {
  config?: {
    handled?: boolean;
  };
}

/**
 * Возможные типы ошибок - упрощаем до unknown
 */
export type PossibleError = unknown;

// ========================================
// Type guards для ошибок
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
