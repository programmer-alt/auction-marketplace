import { AxiosError } from 'axios';
import { DetailedError } from '../types/advanced';

// Тип для пометки ошибок как обработанных
export interface HandledError extends Error {
  config?: {
    handled?: boolean;
  };
}

// Расширяем тип для Axios ошибок
export interface HandledAxiosError extends AxiosError {
  config?: NonNullable<AxiosError['config']> & {
    handled?: boolean;
  };
}

// Тип Union для всех возможных типов ошибок
export type PossibleError = Error | HandledError | HandledAxiosError | AxiosError | DetailedError | unknown;

// Вспомогательная функция для пометки ошибки как обработанной
export const markErrorAsHandled = (error: PossibleError): void => {
  if (error && typeof error === 'object') {
    // Проверяем, есть ли у объекта прототип Error
    if (Object.prototype.isPrototypeOf.call(Error.prototype, error) || error instanceof Error) {
      if (!('config' in error) || error.config === undefined) {
        (error as HandledError).config = {};
      }
      (error as HandledError).config!.handled = true;
    } else if ('isAxiosError' in error && (error as AxiosError).isAxiosError) {
      // Для axios ошибок
      if (!(error as HandledAxiosError).config) {
        (error as HandledAxiosError).config = ((error as AxiosError).config || {}) as any;
      }
      (error as HandledAxiosError).config!.handled = true;
    } else {
      // Для других типов ошибок, которые могут быть plain objects
      (error as any).config = (error as any).config || {};
      (error as any).config.handled = true;
    }
  }
};

// Экспортируем DetailedError для использования в других модулях
export type { DetailedError };