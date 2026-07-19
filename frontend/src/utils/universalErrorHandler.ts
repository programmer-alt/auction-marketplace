import toast from 'react-hot-toast';
import { markErrorAsHandled } from './errorHandler';
import { PossibleError } from '../types/errorTypes';
import { ErrorContract, ErrorCategory, DetailedError, isHandledError, isAxiosError } from '../types/advanced';

/**
 * Универсальный обработчик ошибок
 * @param error - Ошибка для обработки
 * @param customMessage - Пользовательское сообщение об ошибке
 * @param category - Категория ошибки
 * @returns Детализированная ошибка
 */
export const handleError = (
  error: PossibleError,
  customMessage?: string,
  category?: ErrorCategory
): DetailedError => {
  // Если ошибка уже отмечена как обработанная, просто возвращаем её
  if (isHandledError(error)) {
    const errorMessage = error.message || 'Unknown error';
    return {
      message: errorMessage,
      level: 'error',
      handled: true,
      category: category || ErrorCategory.UNKNOWN,
      originalError: error
    };
  }

  // Определяем категорию ошибки, если не указана
  const determinedCategory = category || categorizeError(error);

  // Определяем сообщение об ошибке
  let message = customMessage;

  if (!message) {
    // Проверяем различные источники сообщений об ошибке
    if (isAxiosError(error)) {
      // Используем явное приведение к типу для доступа к свойствам
      const axiosErr = error as import('axios').AxiosError;
      if (axiosErr.response?.data && typeof axiosErr.response.data === 'object' && 'error' in axiosErr.response.data) {
        message = (axiosErr.response.data as any).error;
      } else if (axiosErr.response?.data && typeof axiosErr.response.data === 'object' && 'message' in axiosErr.response.data) {
        message = (axiosErr.response.data as any).message;
      } else if (axiosErr.message) {
        message = axiosErr.message;
      }
    } else if ((error as Error)?.message) {
      message = (error as Error).message;
    } else if (typeof error === 'string') {
      message = error;
    } else {
      message = 'Произошла неизвестная ошибка';
    }
  }

  // Определяем уровень ошибки на основе категории
  const level = determineLogLevel(determinedCategory);

  // Создаем объект ошибки с контрактом
  const errorContract: DetailedError = {
    message: message || 'Произошла неизвестная ошибка', // Убедимся, что сообщение не undefined
    level,
    category: determinedCategory,
    originalError: error,
    timestamp: new Date()
  };

  // Показываем уведомление в зависимости от уровня
  showNotification(errorContract);

  // Помечаем ошибку как обработанную
  if (error && typeof error === 'object' && error.constructor !== String && error.constructor !== Number && error.constructor !== Boolean) {
    markErrorAsHandled(error);
  }

  return errorContract;
};

/**
 * Классифицирует ошибку на основе её характеристик
 */
const categorizeError = (error: PossibleError): ErrorCategory => {
  // Проверяем, является ли ошибка axios ошибкой
  if (isAxiosError(error)) {
    const axiosErr = error as import('axios').AxiosError;
    
    if (!axiosErr.response) {
      if (axiosErr.request) {
        // Network error (no response received)
        return ErrorCategory.NETWORK;
      } else {
        // Request was made but no response received
        return ErrorCategory.NETWORK;
      }
    }

    // Проверяем статус ошибки
    const status = axiosErr.response?.status;
    switch (status) {
      case 400:
        return ErrorCategory.VALIDATION;
      case 401:
        return ErrorCategory.AUTHENTICATION;
      case 403:
        return ErrorCategory.AUTHORIZATION;
      case 404:
        return ErrorCategory.BUSINESS_LOGIC;
      case 409:
        return ErrorCategory.BUSINESS_LOGIC;
      case 422:
        return ErrorCategory.VALIDATION;
      case 429:
        return ErrorCategory.BUSINESS_LOGIC;
      case 500:
      case 502:
      case 503:
      case 504:
        return ErrorCategory.SERVER_ERROR;
      default:
        if (status && status >= 400 && status < 500) {
          return ErrorCategory.BUSINESS_LOGIC;
        } else if (status && status >= 500) {
          return ErrorCategory.SERVER_ERROR;
        }
        return ErrorCategory.UNKNOWN;
    }
  } else if (error && typeof error === 'object') {
    // Проверяем другие типы ошибок
    return ErrorCategory.UNKNOWN;
  } else {
    return ErrorCategory.UNKNOWN;
  }
};

// ... остальная часть файла остается без изменений ...

/**
 * Определяет уровень логирования на основе категории ошибки
 */
const determineLogLevel = (category: ErrorCategory): ErrorContract['level'] => {
  switch (category) {
    case ErrorCategory.NETWORK:
    case ErrorCategory.SERVER_ERROR:
      return 'error';
    case ErrorCategory.AUTHENTICATION:
    case ErrorCategory.AUTHORIZATION:
      return 'warning';
    case ErrorCategory.VALIDATION:
    case ErrorCategory.BUSINESS_LOGIC:
      return 'info';
    default:
      return 'error';
  }
};

/**
 * Показывает уведомление в зависимости от уровня ошибки
 */
const showNotification = (errorContract: DetailedError) => {
  const { message, level } = errorContract;

  switch (level) {
    case 'info':
      toast(message);
      break;
    case 'warning':
      toast(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'critical':
      toast.error(message, { duration: 10000 }); // Показываем критические ошибки дольше
      break;
    default:
      toast.error(message);
  }
};

/**
 * Вспомогательная функция для обработки бизнес-логики ошибок
 */
export const handleBusinessLogicError = (error: PossibleError, context?: Record<string, any>): DetailedError => {
  const result = handleError(error, undefined, ErrorCategory.BUSINESS_LOGIC);
  // Если передан контекст, добавляем его к результату
  if (context) {
    result.context = context;
  }
  return result;
};

/**
 * Вспомогательная функция для обработки сетевых ошибок
 */
export const handleNetworkError = (error: PossibleError): DetailedError => {
  const message = isAxiosError(error) && !(error as import('axios').AxiosError).response
    ? 'Нет соединения с сервером. Проверьте подключение к интернету.' 
    : 'Ошибка сети при выполнении запроса.';
  
  return handleError(error, message, ErrorCategory.NETWORK);
};

/**
 * Вспомогательная функция для обработки ошибок валидации
 */
export const handleValidationError = (error: PossibleError): DetailedError => {
  return handleError(error, undefined, ErrorCategory.VALIDATION);
};

/**
 * Вспомогательная функция для обработки ошибок аутентификации
 */
export const handleAuthError = (error: PossibleError): DetailedError => {
  return handleError(error, undefined, ErrorCategory.AUTHENTICATION);
};

/**
 * Вспомогательная функция для обработки ошибок авторизации
 */
export const handleAuthzError = (error: PossibleError): DetailedError => {
  return handleError(error, undefined, ErrorCategory.AUTHORIZATION);
};

/**
 * Вспомогательная функция для обработки ошибок сервера
 */
export const handleServerError = (error: PossibleError): DetailedError => {
  return handleError(error, undefined, ErrorCategory.SERVER_ERROR);
};