/**
 * Object utility types
 */

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
