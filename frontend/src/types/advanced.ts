/**
 * Продвинутые типы TypeScript для проекта Global Auction Marketplace
 * Использует условные типы, mapped types, template literal types и другие возможности
 */

import { Auction, Bid, User, Payment } from './index';
import { AxiosError } from 'axios';

// Создаем типы статусов на основе существующих интерфейсов
export type AuctionStatus = Auction['status'];
export type PaymentStatus = Payment['status'];

// ========================================
// Типы для обработки ошибок
// ========================================

/**
 * Определяем контракт ошибки для унификации обработки
 */
export interface ErrorContract {
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  context?: Record<string, any>;
  handled?: boolean;
  timestamp?: Date;
}

/**
 * Категории ошибок для классификации
 */
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
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
 * Расширяет Error и добавляет конфигурационное свойство handled
 */
export interface HandledError extends Error {
  config?: {
    handled?: boolean;
  };
}

// ========================================
// Базовые утилиты
// ========================================

/**
 * Делает все свойства объекта опциональными (включая вложенные)
 * Пример использования: DeepPartial<Auction> для обновления аукциона
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

/**
 * Делает все свойства объекта обязательными (включая вложенные)
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepRequired<U>>
      : DeepRequired<T[P]>
    : T[P];
};

/**
 * Делает все свойства объекта доступными только для чтения (включая вложенные)
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};

/**
 * Извлекает тип элемента из массива
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Создает тип из ключей объекта, где значения соответствуют типу U
 */
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Исключает свойства с типом U из объекта
 */
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

// ========================================
// Типы для аукционов
// ========================================

/**
 * Статусы аукциона как union тип
 */
export type AuctionStatusUnion = Auction['status'];

/**
 * Тип для фильтрации аукционов по статусу
 */
export type AuctionByStatus<S extends AuctionStatusUnion> = Auction & { status: S };

/**
 * Тип для активных аукционов
 */
export type ActiveAuction = AuctionByStatus<'ACTIVE'>;

/**
 * Тип для завершенных аукционов
 */
export type CompletedAuction = AuctionByStatus<'COMPLETED'>;

/**
 * Тип для отмененных аукционов
 */
export type CancelledAuction = AuctionByStatus<'CANCELLED'>;

/**
 * Тип для аукциона с минимальными данными (для списков)
 */
export type AuctionPreview = Pick<
  Auction,
  'id' | 'title' | 'imageUrl' | 'currentPrice' | 'status' | 'endsAt' | 'seller'
>;

/**
 * Тип для детального представления аукциона
 */
export type AuctionDetail = Auction & {
  bids: Bid[];
  seller: User;
  winner: User | null;
};

// ========================================
// Типы для ставок
// ========================================

/**
 * Тип для создания ставки (без id и временных меток)
 */
export type BidCreate = Omit<Bid, 'id' | 'createdAt' | 'user'> & {
  userId: number;
};

/**
 * Тип для ставки с расширенной информацией об аукционе
 */
export type BidWithAuction = Bid & {
  auction: Pick<Auction, 'id' | 'title' | 'currentPrice' | 'status'>;
};

// ========================================
// Типы для пользователей
// ========================================

/**
 * Тип для публичного профиля пользователя (без чувствительных данных)
 */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'createdAt'>;

/**
 * Тип для обновления профиля пользователя
 */
export type UserUpdate = Partial<Pick<User, 'name' | 'email'>>;

// ========================================
// Типы для платежей
// ========================================

/**
 * Статусы платежа как union тип
 */
export type PaymentStatusUnion = Payment['status'];

/**
 * Тип для платежа с деталями аукциона
 */
export type PaymentWithAuction = Payment & {
  auction: Pick<Auction, 'id' | 'title' | 'imageUrl' | 'sellerId'>;
};

// ========================================
// Типы для API
// ========================================

/**
 * Базовый тип для успешного ответа API
 */
export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

/**
 * Базовый тип для ошибки API
 */
export type ApiError = {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
};

/**
 * Union тип для ответа API
 */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Тип для пагинированного ответа
 */
export type PaginatedApiResponse<T> = ApiSuccess<{
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}>;

/**
 * Тип для параметров пагинации
 */
export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

// ========================================
// Условные типы и infer
// ========================================

/**
 * Извлекает тип данных из ApiResponse
 * Пример использования: ExtractApiData<ApiResponse<AuctionDetail>> -> AuctionDetail
 */
export type ExtractApiData<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Извлекает тип элемента из PaginatedApiResponse
 */
export type ExtractPaginatedItem<T> = T extends PaginatedApiResponse<infer U>
  ? U
  : never;

/**
 * Извлекает тип параметров функции
 */
export type Parameters<T> = T extends (...args: infer P) => any ? P : never;

/**
 * Извлекает тип возвращаемого значения функции
 */
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// ========================================
// Mapped types для форм
// ========================================

/**
 * Создает тип для формы валидации на основе схемы Zod
 * Пример использования: FormErrors<CreateAuctionData> -> { title?: string[], startingPrice?: string[] }
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

// ========================================
// Template literal types
// ========================================

/**
 * Создает тип для ключей событий аукциона
 */
export type AuctionEvent = `auction:${AuctionStatusUnion | 'created' | 'updated' | 'deleted'}`;

/**
 * Создает тип для ключей событий ставок
 */
export type BidEvent = `bid:${'created' | 'updated' | 'deleted' | 'won'}`;

/**
 * Создает тип для всех событий WebSocket
 */
export type WebSocketEvent = AuctionEvent | BidEvent | `payment:${PaymentStatusUnion}`;

/**
 * Создает тип для обработчиков событий
 * Пример использования: EventHandlers для WebSocket-событий
 */
export type EventHandlers = {
  [K in WebSocketEvent as `on${Capitalize<K>}`]?: (data: any) => void;
};

// ========================================
// Discriminated unions для состояний
// ========================================

/**
 * Состояние загрузки данных
 */
export type LoadingState = {
  status: 'idle' | 'loading' | 'refreshing';
  error?: string;
};

/**
 * Состояние успешной загрузки данных
 */
export type SuccessState<T> = {
  status: 'success';
  data: T;
  updatedAt: Date;
};

/**
 * Состояние ошибки загрузки данных
 */
export type ErrorState = {
  status: 'error';
  error: string;
  retryCount: number;
};

/**
 * Union тип для состояния асинхронных данных
 */
export type AsyncState<T> = LoadingState | SuccessState<T> | ErrorState;

/**
 * Тип для состояния аукциона с discriminated union
 * Пример использования: AuctionState в компоненте аукциона
 */
export type AuctionState =
  | { type: 'not_found' }
  | { type: 'loading' }
  | { type: 'active'; auction: ActiveAuction }
  | { type: 'completed'; auction: CompletedAuction; winner: User | null }
  | { type: 'cancelled'; auction: CancelledAuction; reason?: string };

// ========================================
// Утилиты для работы с датами
// ========================================

/**
 * Тип для представления даты в разных форматах
 */
export type DateLike = Date | string | number;

/**
 * Тип для временного интервала
 */
export type TimeRange = {
  from: DateLike;
  to: DateLike;
};

/**
 * Тип для фильтрации по дате
 */
export type DateFilter = {
  field: 'createdAt' | 'endsAt' | 'updatedAt';
  range: TimeRange;
};

// ========================================
// Утилиты для Type Guards
// ========================================

/**
 * Type guard для проверки типа ApiSuccess
 * Пример использования: if(isApiSuccess(response)) { console.log(response.data); }
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

/**
 * Type guard для проверки активного аукциона
 */
export function isActiveAuction(auction: Auction): auction is ActiveAuction {
  return auction.status === 'ACTIVE';
}

/**
 * Type guard для проверки завершенного аукциона
 */
export function isCompletedAuction(auction: Auction): auction is CompletedAuction {
  return auction.status === 'COMPLETED';
}

/**
 * Type guard для проверки успешного состояния
 */
export function isSuccessState<T>(state: AsyncState<T>): state is SuccessState<T> {
  return state.status === 'success';
}

/**
 * Type guard для проверки ошибки как HandledError
 */
export function isHandledError(error: any): error is HandledError {
  return error && typeof error === 'object' && error.config?.handled === true;
}

/**
 * Type guard для проверки ошибки как AxiosError
 */
export function isAxiosError(error: any): error is AxiosError {
  return error && typeof error === 'object' && 'isAxiosError' in error;
}

// ========================================
// Утилиты для работы с объектами
// ========================================

/**
 * Создает тип для immutable объекта
 */
export type Immutable<T> = {
  readonly [K in keyof T]: Immutable<T[K]>;
};

/**
 * Создает тип для partial immutable объекта (только для чтения, но свойства опциональны)
 */
export type ReadonlyPartial<T> = {
  readonly [K in keyof T]?: T[K];
};

/**
 * Создает тип для объекта, где все свойства могут быть null
 */
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

// ========================================
// Утилиты для компонентов React
// ========================================

/**
 * Тип для пропсов компонента с children
 */
export type PropsWithChildren<P = {}> = P & {
  children?: React.ReactNode;
};

/**
 * Тип для пропсов компонента с className
 */
export type PropsWithClassName<P = {}> = P & {
  className?: string;
};

/**
 * Тип для пропсов компонента с обработчиками событий
 */
export type PropsWithHandlers<P = {}> = P & {
  onClick?: React.MouseEventHandler;
  onChange?: React.ChangeEventHandler;
  onSubmit?: React.FormEventHandler;
};

// ========================================
// Примеры использования
// ========================================

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
  status?: AuctionStatusUnion | 'ALL';
  minPrice?: number;
  maxPrice?: number;
  sellerId?: number;
  endsBefore?: DateLike;
  search?: string;
} & PaginationParams;

/**
 * Пример: Тип для контекста аутентификации
 */
export type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<ApiResponse<User>>;
  logout: () => void;
  register: (data: { email: string; password: string; name: string }) => Promise<ApiResponse<User>>;
  updateProfile: (data: UserUpdate) => Promise<ApiResponse<User>>;
};

// ========================================
// Экспорт всех типов
// ========================================

export type {
  Auction,
  Bid,
  User,
  Payment,
} from './index';