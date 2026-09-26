/**
 * Async state types
 */

// ========================================
// Состояние загрузки данных
// ========================================

/**
 * Состояние загрузки данных
 */
export type LoadingState = {
  status: "idle" | "loading" | "refreshing";
  error?: string;
};

/**
 * Состояние успешной загрузки данных
 */
export type SuccessState<T> = {
  status: "success";
  data: T;
  updatedAt: Date;
};

/**
 * Состояние ошибки загрузки данных
 */
export type ErrorState = {
  status: "error";
  error: string;
  retryCount: number;
};

/**
 * Union тип для состояния асинхронных данных
 */
export type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

/**
 * Type guard для проверки успешного состояния
 */
export function isSuccessState<T>(state: AsyncState<T>): state is SuccessState<T> {
  return state.status === "success";
}
