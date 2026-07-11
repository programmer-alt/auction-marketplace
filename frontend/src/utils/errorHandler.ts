// Тип для пометки ошибок как обработанных
export interface HandledError extends Error {
  config?: {
    handled?: boolean;
  };
}

// Вспомогательная функция для пометки ошибки как обработанной
export const markErrorAsHandled = (error: any): void => {
  if (error && typeof error === 'object') {
    // Проверяем, есть ли у объекта прототип Error
    if (Object.prototype.isPrototypeOf.call(Error.prototype, error) || error instanceof Error) {
      error.config = error.config || {};
      error.config.handled = true;
    } else if (error.isAxiosError) {
      // Для axios ошибок
      error.config = error.config || {};
      error.config.handled = true;
    }
  }
};