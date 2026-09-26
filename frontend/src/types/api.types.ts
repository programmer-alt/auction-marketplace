/**
 * API response types
 */

// ========================================
// Базовые типы для ответов API
// ========================================

/**
 * Базовый тип для успешного ответа API
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Базовый тип для ошибки API
 */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * Union тип для ответа API
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Тип для пагинированного ответа
 */
export interface PaginatedApiResponse<T> {
  success: true;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Тип для параметров пагинации
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ========================================
// Утилиты для извлечения данных
// ========================================

/**
 * Извлекает тип данных из ApiResponse
 */
export type ExtractApiData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Извлекает тип элемента из PaginatedApiResponse
 */
export type ExtractPaginatedItem<T> = T extends PaginatedApiResponse<infer U> ? U : never;

// ========================================
// Type guards
// ========================================

/**
 * Type guard для проверки типа ApiSuccess
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccess<T> {
  return response.success === true;
}

/**
 * Type guard для проверки типа ApiError
 */
export function isApiError<T>(response: ApiResponse<T>): response is ApiError {
  return response.success === false;
}
