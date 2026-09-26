/**
 * Form-related types
 */

/**
 * Создает тип для формы валидации на основе схемы Zod
 */
export type FormErrors<T> = {
  [K in keyof T]?: string[];
};

/**
 * Создает тип для состояния формы (значение, ошибка, touched)
 */
export type FormFieldState<T> = {
  value: T;
  error?: string;
  touched: boolean;
};

/**
 * Создает тип для всей формы
 */
export type FormState<T extends Record<string, any>> = {
  [K in keyof T]: FormFieldState<T[K]>;
} & {
  isValid: boolean;
  isSubmitting: boolean;
};

/**
 * Пример: Создание типа для формы создания аукциона
 */
export type CreateAuctionForm = FormState<{
  title: string;
  description: string;
  startingPrice: number;
  endsAt: string;
  imageUrl: string;
}>;

/**
 * Пример: Создание типа для фильтров аукционов
 */
export type AuctionFilters = {
  status?: string | "ALL";
  minPrice?: number;
  maxPrice?: number;
  sellerId?: number;
  endsBefore?: string | number | Date;
  search?: string;
} & {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};
