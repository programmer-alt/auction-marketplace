/**
 * Utility types
 */

/**
 * Делает все свойства объекта опциональными (включая вложенные)
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
  readonly [P in keyof T]: T[P] extends object ? (T[P] extends Function ? T[P] : DeepReadonly<T[P]>) : T[P];
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
