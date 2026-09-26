/**
 * Date-related types
 */

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
  field: "createdAt" | "endsAt" | "updatedAt";
  range: TimeRange;
};
