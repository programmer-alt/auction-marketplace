import { AxiosError } from 'axios';
import { DetailedError, HandledError, isAxiosError } from '../types/advanced';

/**
 * Упрощенная функция для пометки ошибки как обработанной
 * Принимает только конкретные типы ошибок вместо unknown
 */
export const markErrorAsHandled = (error: Error | AxiosError | DetailedError | unknown): void => {
  if (!error) return;

  // Для AxiosError проверяем наличие config
  if (isAxiosError(error)) {
    if (!error.config) {
      error.config = { headers: {} } as AxiosError['config'];
    }
    if (error.config) {
      const config = error.config as unknown as Record<string, unknown>;
      config.handled = true;
    }
    return;
  }

  // Для других типов ошибок добавляем свойство handled
  const handledError = error as HandledError;
  if (handledError && typeof handledError === 'object') {
    if (!handledError.config) {
      (handledError as HandledError).config = {};
    }
    if (handledError.config) {
      handledError.config.handled = true;
    }
  }
};

// Экспортируем типы для использования в других модулях
export type { HandledError, DetailedError };