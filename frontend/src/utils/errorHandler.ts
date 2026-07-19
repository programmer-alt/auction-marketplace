import { AxiosError } from 'axios';
import { DetailedError, HandledError, isAxiosError } from '../types/advanced';

/**
 * Упрощенная функция для пометки ошибки как обработанной
 * Принимает только конкретные типы ошибок вместо unknown
 */
export const markErrorAsHandled = (error: Error | AxiosError | DetailedError): void => {
  if (!error) return;

  // Для AxiosError проверяем наличие config
  if (isAxiosError(error)) {
    if (!error.config) {
      error.config = { headers: {} } as any; // Задаем базовую структуру для config
    }
    (error.config as any).handled = true; // Явно приводим к any для обхода строгой проверки
    return;
  }

  // Для других типов ошибок добавляем свойство handled
  const handledError = error as HandledError;
  if (!handledError.config) {
    handledError.config = {};
  }
  handledError.config!.handled = true;
};

// Экспортируем типы для использования в других модулях
export type { HandledError, DetailedError };