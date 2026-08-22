/**
 * Утилита для очистки строк от потенциально опасного контента
 * Защита от XSS-атак и инъекций
 */

/**
 * Базовая очистка строки от HTML-тегов и специальных символов
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .replace(/[<>]/g, "") // Удаление < и >
    .replace(/javascript:/gi, "") // Удаление javascript: протокола
    .replace(/on\w+=/gi, "") // Удаление обработчиков событий (onclick= и т.д.)
    .trim();
}

/**
 * Очистка HTML-контента (сохранение разрешенных тегов)
 */
export function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  if (typeof input !== "string") {
    return "";
  }

  // Создаем регулярное выражение для разрешенных тегов
  const allowedTagsPattern = allowedTags.length > 0 ? `(${allowedTags.join("|")})` : "";

  // Удаляем все теги, кроме разрешенных
  let sanitized = input.replace(/<script[^<]*<\/script>/gi, ""); // Удаляем script теги

  if (allowedTagsPattern) {
    // Удаляем все теги, кроме разрешенных
    sanitized = sanitized.replace(new RegExp(`<(?!${allowedTagsPattern})\/?[\w\s="'-]+>`, "gi"), "");
  } else {
    // Удаляем все теги
    sanitized = sanitized.replace(/<[^>]*>/g, "");
  }

  return sanitized;
}

/**
 * Очистка URL от потенциально опасных протоколов
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const trimmed = input.trim();

  // Проверяем на опасные протоколы
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lowerInput = trimmed.toLowerCase();

  for (const protocol of dangerousProtocols) {
    if (lowerInput.startsWith(protocol)) {
      return "";
    }
  }

  return trimmed;
}

/**
 * Очистка объекта, рекурсивно обрабатывая все строковые поля
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    skipKeys?: string[];
    sanitizeHtml?: boolean;
    allowedHtmlTags?: string[];
  } = {},
): T {
  const { skipKeys = [], sanitizeHtml: allowHtml = false, allowedHtmlTags = [] } = options;

  const sanitized: Record<string, unknown> = { ...obj };

  for (const key in sanitized) {
    if (skipKeys.includes(key)) {
      continue;
    }

    const value = sanitized[key as keyof typeof sanitized];

    if (typeof value === "string") {
      sanitized[key as keyof typeof sanitized] = allowHtml
        ? sanitizeHtml(value, allowedHtmlTags)
        : sanitizeString(value);
    } else if (typeof value === "object" && value !== null) {
      // Use Record<string, unknown> for nested objects to avoid forcing
      // incompatible shapes onto the parent generic T.  The final cast
      // to T happens only once at the return statement.
      const nestedResult = sanitizeObject<Record<string, unknown>>(value as Record<string, unknown>, options);
      sanitized[key as keyof typeof sanitized] = nestedResult;
    }
  }

  return sanitized as T;
}

/**
 * Валидация и очистка email-адреса
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  const trimmed = input.trim().toLowerCase();

  // Базовая проверка формата email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return "";
  }

  return trimmed;
}

/**
 * Очистка числового значения
 */
export function sanitizeNumber(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isNaN(input) ? null : input;
  }

  if (typeof input === "string") {
    const parsed = Number.parseFloat(input);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}
