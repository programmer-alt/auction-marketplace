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
 * Опции для составных курсоров (несколько полей сортировки)
 */
export interface CompositeCursorPaginationOptions extends CursorPaginationOptions {
  /** Поля сортировки (например, ['createdAt', 'id']) */
  cursorFields?: string[];
}

/**
 * Тип для значения курсора: может быть примитивом или объектом для составных курсоров
 */
export type CursorValue = string | number | boolean | Date | Record<string, unknown>;

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

export function createCursorByField<T extends CursorValue>(
  value: T,
  field: string = 'id',
): string {
  return encodeCursor({ [field]: value });
}

/**
 * Создание составного курсора по нескольким полям
 */
export function createCompositeCursor<T extends Record<string, CursorValue>>(
  values: T,
): string {
  return encodeCursor(values);
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
 * Парсинг опций для составных курсоров
 */
export function parseCompositePaginationOptions(
  options: CompositeCursorPaginationOptions,
): {
  cursor: Record<string, CursorValue> | null;
  limit: number;
  direction: 'next' | 'prev';
  cursorFields: string[];
} {
  const { cursor, limit, direction } = parsePaginationOptions(options);
  const cursorFields = options.cursorFields || ['id'];

  // Если курсор существует и является объектом, приводим к Record<string, CursorValue>
  let parsedCursor: Record<string, CursorValue> | null = null;
  if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) {
    parsedCursor = cursor as Record<string, CursorValue>;
  } else if (cursor !== null && cursorFields.length > 0) {
    parsedCursor = { [cursorFields[0]]: cursor as CursorValue };
  }

  return { cursor: parsedCursor, limit, direction, cursorFields };
}




/**
 * Валидация типа значения курсора
 * Проверяет, что значение соответствует ожидаемому типу (строка, число, Date)
 */
export function validateCursorValue(
  value: unknown,
  expectedType: 'string' | 'number' | 'date' = 'string',
): boolean {
  if (value === null || value === undefined) return false;

  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    default:
      return false;
  }
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
    const lastItem = paginatedData[paginatedData.length - 1];
    const cursorValue = lastItem[cursorField];

    if (direction === 'next') {
      nextCursor = hasMore
        ? createCursorByField(cursorValue, cursorField)
        : undefined;
      // Предыдущий курсор рассчитываем только если входной курсор был задан
      // (в этой функции он не передаётся, поэтому оставляем undefined)
      prevCursor = undefined;
    } else {
      // Следующий курсор вычисляем только для режима prev.
      // Входной cursor параметр здесь не доступен, поэтому оставляем undefined.
      nextCursor = undefined;
      prevCursor = hasMore
        ? createCursorByField(cursorValue, cursorField)
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
 * Создание результата пагинации для составных курсоров
 */
export function createCompositePaginationResult<T extends Record<string, any>>(
  data: T[],
  limit: number,
  cursorFields: string[] = ['id'],
  direction: 'next' | 'prev' = 'next'
): CursorPaginationResult<T> {
  const hasMore = data.length > limit;
  const paginatedData = hasMore ? data.slice(0, limit) : data;

  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  if (paginatedData.length > 0) {
    const lastItem = paginatedData[paginatedData.length - 1];
    const cursorValues: Record<string, CursorValue> = {};
    for (const field of cursorFields) {
      if (field in lastItem) {
        cursorValues[field] = lastItem[field];
      }
    }

    if (Object.keys(cursorValues).length > 0) {
      if (direction === 'next') {
        nextCursor = hasMore ? createCompositeCursor(cursorValues) : undefined;
        prevCursor = undefined;
      } else {
        nextCursor = undefined;
        prevCursor = hasMore ? createCompositeCursor(cursorValues) : undefined;
      }
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
 * Создание условий Prisma для курсорной пагинации (одиночное поле)
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

  // Простая валидация типа
  if (typeof cursorValue !== 'string' && typeof cursorValue !== 'number' && !(cursorValue instanceof Date)) {
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

/**
 * Создание условий Prisma для составных курсоров (несколько полей сортировки)
 * Генерирует условие вида: (field1 > val1) OR (field1 = val1 AND field2 > val2) ...
 */
export function createCompositeCursorWhereClause(
  cursor: Record<string, CursorValue> | null,
  cursorFields: string[] = ['id'],
  direction: 'next' | 'prev' = 'next'
): Record<string, unknown> {
  if (!cursor || cursorFields.length === 0) {
    return {};
  }

  // Проверяем, что все поля присутствуют в курсоре
  for (const field of cursorFields) {
    if (!(field in cursor)) {
      return {};
    }
  }

  const operator = direction === 'next' ? 'gt' : 'lt';

  // Для одного поля простое условие
  if (cursorFields.length === 1) {
    const field = cursorFields[0];
    return {
      [field]: { [operator]: cursor[field] },
    };
  }

  // Для нескольких полей строим сложное условие OR с AND
  // (field1 > val1) OR (field1 = val1 AND field2 > val2) OR ...
  const orConditions: Record<string, unknown>[] = [];

  for (let i = 0; i < cursorFields.length; i++) {
    const andConditions: Record<string, unknown> = {};
    // Для всех предыдущих полей добавляем равенство
    for (let j = 0; j < i; j++) {
      const prevField = cursorFields[j];
      andConditions[prevField] = { equals: cursor[prevField] };
    }
    // Для текущего поля добавляем оператор сравнения
    const currentField = cursorFields[i];
    andConditions[currentField] = { [operator]: cursor[currentField] };
    orConditions.push(andConditions);
  }

  return { OR: orConditions };
}

/**
 * Создание порядка сортировки для Prisma
 */
export function createOrderBy(
  cursorFields: string[] = ['id'],
  direction: 'next' | 'prev' = 'next'
): Record<string, 'asc' | 'desc'>[] {
  const order = direction === 'next' ? 'asc' : 'desc';
  return cursorFields.map(field => ({ [field]: order }));
}

/**
 * Вспомогательная функция для использования пагинации в Prisma-транзакциях
 * Принимает Prisma-транзакцию и возвращает результат пагинации
 */
export async function paginateWithTransaction<T extends Record<string, unknown>>(
  prisma: unknown,
  findManyArgs: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[];
    include?: unknown;
    select?: unknown;
  },
  options: CompositeCursorPaginationOptions
): Promise<CursorPaginationResult<T>> {
  const { cursor, limit, direction, cursorFields } = parseCompositePaginationOptions(options);
  const whereClause = createCompositeCursorWhereClause(cursor, cursorFields, direction);
  const orderBy = createOrderBy(cursorFields, direction);

  const combinedWhere = {
    ...findManyArgs.where,
    ...whereClause,
  };

  const data = await (prisma as any).findMany({
    ...findManyArgs,
    where: combinedWhere,
    orderBy,
    take: limit + 1,
  });

  // Если направление назад, переворачиваем результат
  const sortedData = direction === 'prev' ? data.reverse() : data;

  return createCompositePaginationResult(sortedData, limit, cursorFields, direction);
}
