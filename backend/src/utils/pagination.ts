/**
 * Утилита для курсорной пагинации
 * Более эффективна для больших объемов данных по сравнению с offset/limit
 */

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  direction?: 'next' | 'prev';
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
}

/**
 * Кодирование курсора в base64
 */
export function encodeCursor<T>(value: T): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/**
 * Декодирование курсора из base64
 */
export function decodeCursor<T = unknown>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as T;
  } catch {
    return null;
  }
}

/**
 * Создание курсора на основе значения и поля сортировки
 */
export function createCursor<T extends Record<string, unknown>>(
  value: T,
): string {
  return encodeCursor(value);
}

export function createCursorByField<T>(
  value: T,
  field: string = 'id',
): string {
  return encodeCursor({ [field]: value } as Record<string, unknown>);
}

/**
 * Парсинг опций пагинации с значениями по умолчанию
 */
export function parsePaginationOptions(options: CursorPaginationOptions): {
  cursor: unknown;
  limit: number;
  direction: 'next' | 'prev';
} {
  const limit = Math.min(Math.max(options.limit || 10, 1), 100); // Ограничиваем limit от 1 до 100
  const direction = options.direction || 'next';
  const cursor = options.cursor ? decodeCursor<unknown>(options.cursor) : null;

  return { cursor, limit, direction };
}

/**
 * Создание результата пагинации
 */
export function createPaginationResult<T extends Record<string, any>>(
  data: T[],
  limit: number,
  cursorField: string = 'id',
  direction: 'next' | 'prev' = 'next'
): CursorPaginationResult<T> {
  const hasMore = data.length > limit;
  const paginatedData = hasMore ? data.slice(0, limit) : data;

  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  if (paginatedData.length > 0) {
    const lastItem = paginatedData[paginatedData.length - 1] as any;

    if (direction === 'next') {
      nextCursor = hasMore
        ? createCursorByField(lastItem[cursorField], cursorField)
        : undefined;
      // Предыдущий курсор рассчитываем только если входной курсор был задан
      // (в этой функции он не передаётся, поэтому оставляем undefined)
      prevCursor = undefined;
    } else {
      // Следующий курсор вычисляем только для режима prev.
      // Входной cursor параметр здесь не доступен, поэтому оставляем undefined.
      nextCursor = undefined;
      prevCursor = hasMore
        ? createCursorByField(lastItem[cursorField], cursorField)
        : undefined;
    }
  }

  return {
    data: paginatedData,
    nextCursor,
    prevCursor,
    hasMore,
  };
}

/**
 * Создание условий Prisma для курсорной пагинации
 */
export function createCursorWhereClause(
  cursor: unknown,
  cursorField: string = 'id',
  direction: 'next' | 'prev' = 'next'
): Record<string, unknown> {
  if (!cursor || typeof cursor !== 'object') {
    return {};
  }

  const cursorObj = cursor as Record<string, unknown>;
  const cursorValue = cursorObj[cursorField];
  if (cursorValue === undefined || cursorValue === null) {
    return {};
  }

  if (direction === 'next') {
    return {
      [cursorField]: { gt: cursorValue },
    };
  } else {
    return {
      [cursorField]: { lt: cursorValue },
    };
  }
}
