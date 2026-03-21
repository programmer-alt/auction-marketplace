/**
 * Безопасно парсит JSON строку с ограничением глубины и обработкой ошибок.
 * @param text JSON строка
 * @param maxDepth Максимальная допустимая глубина (по умолчанию 20)
 * @returns Распарсенный объект или null при ошибке
 */
export function safeJsonParse<T = any>(text: string, maxDepth = 20): T | null {
  if (typeof text !== "string") {
    return null;
  }

  if (text.length > 10_000_000) {
    console.warn("JSON string too long, rejecting");
    return null;
  }

  let depth = 0;
  const reviver = (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      depth++;
      if (depth > maxDepth) {
        throw new Error("Максимум глубина аукциона превышена");
      }
    }
    if (key === "__proto__" || key === "constructor") {
      return undefined;
    }
    return value;
  };

  try {
    depth = 0;
    return JSON.parse(text, reviver);
  } catch (err) {
    console.warn("Failed to parse JSON from cache:", err);
    return null;
  }
}

/**
 * Валидирует объект аукциона (базовые проверки).
 * @param obj Объект для проверки
 * @returns true если объект похож на аукцион
 */
export function validateAuction(obj: any): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  if (
    typeof obj.id !== "number" ||
    typeof obj.title !== "string" ||
    typeof obj.startingPrice !== "number" ||
    typeof obj.sellerId !== "number" ||
    !obj.createdAt ||
    !obj.endsAt
  ) {
    return false;
  }
  return true;
}

/**
 * Валидирует структуру кэшированного списка аукционов.
 * @param obj Объект для проверки
 * @returns true если структура корректна
 */
export function validateAuctionsList(obj: any): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  if (!Array.isArray(obj.auctions) || typeof obj.pagination !== "object") {
    return false;
  }
  const { pagination } = obj;
  if (
    typeof pagination.page !== "number" ||
    typeof pagination.limit !== "number" ||
    typeof pagination.total !== "number" ||
    typeof pagination.totalPages !== "number"
  ) {
    return false;
  }
  return true;
}
