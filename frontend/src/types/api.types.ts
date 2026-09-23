/**
 * Типы для API
 */

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export type ApiErrorResponse = {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
};

export type PaginatedApiResponse<T> = ApiSuccess<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ExtractApiData<T> = T extends ApiSuccess<infer U> ? U : never;

export type ExtractPaginatedItem<T> = T extends PaginatedApiResponse<infer U> ? U : never;