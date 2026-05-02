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
export function encodeCursor(value: any): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/**
 * Декодирование курсора из base64
 */
export function decodeCursor(cursor: string): any {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (error) {
    return null;
  }
}

/**
 * Создание курсора на основе значения и поля сортировки
 */
export function createCursor(value: any, field: string = 'id'): string {
  return encodeCursor({ [field]: value });
}

/**
 * Парсинг опций пагинации с значениями по умолчанию
 */
export function parsePaginationOptions(options: CursorPaginationOptions): {
  cursor: any;
  limit: number;
  direction: 'next' | 'prev';
} {
  const limit = Math.min(Math.max(options.limit || 10, 1), 100); // Ограничиваем limit от 1 до 100
  const direction = options.direction || 'next';
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;

  return { cursor, limit, direction };
}

/**
 * Создание результата пагинации
 */
export function createPaginationResult<T>(
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
    const firstItem = paginatedData[0] as any;
    const lastItem = paginatedData[paginatedData.length - 1] as any;

    if (direction === 'next') {
      nextCursor = hasMore ? createCursor(lastItem[cursorField], cursorField) : undefined;
      prevCursor = cursor ? createCursor(firstItem[cursorField], cursorField) : undefined;
    } else {
      nextCursor = cursor ? createCursor(firstItem[cursorField], cursorField) : undefined;
      prevCursor = hasMore ? createCursor(lastItem[cursorField], cursorField) : undefined;
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
  cursor: any,
  cursorField: string = 'id',
  direction: 'next' | 'prev' = 'next'
): Record<string, any> {
  if (!cursor || !cursor[cursorField]) {
    return {};
  }

  const cursorValue = cursor[cursorField];

  if (direction === 'next') {
    return {
      [cursorField]: {
        gt: cursorValue,
      },
    };
  } else {
    return {
      [cursorField]: {
        lt: cursorValue,
      },
    };
  }
}
