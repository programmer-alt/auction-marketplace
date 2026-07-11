import { CacheAuction, CacheAuctionsList } from "../types";

/**
 * Безопасно парсит JSON строку с ограничением глубины и обработкой ошибок.
 * @param text JSON строка
 * @param maxDepth Максимальная допустимая глубина (по умолчанию 20)
 * @returns Распарсенный объект или null при ошибке
 */
export function safeJsonParse<T>(text: string, maxDepth = 20): T | null {
  if (typeof text !== "string") {
    return null;
  }

  if (text.length > 10_000_000) {
    console.warn("JSON string too long, rejecting");
    return null;
  }

  let depth = 0;
  const reviver = (key: string, value: unknown): unknown => {
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
    return JSON.parse(text, reviver) as T;
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
export function validateAuction(obj: unknown): obj is CacheAuction {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const auction = obj as Record<string, unknown>;
  if (
    typeof auction.id !== "number" ||
    typeof auction.title !== "string" ||
    typeof auction.startingPrice !== "number" ||
    typeof auction.sellerId !== "number" ||
    !auction.createdAt ||
    !auction.endsAt
  ) {
    return false;
  }
  
  // Проверяем поля winnerId и winner
  if (auction.winnerId !== null && typeof auction.winnerId !== "number") {
    return false;
  }
  
  if (auction.winner !== null && typeof auction.winner === "object") {
    const winner = auction.winner as Record<string, unknown>;
    if (typeof winner.id !== "number" || typeof winner.email !== "string") {
      return false;
    }
  }
  
  if (auction.seller !== null && typeof auction.seller === "object") {
    const seller = auction.seller as Record<string, unknown>;
    if (typeof seller.id !== "number" || typeof seller.email !== "string") {
      return false;
    }
  }
  
  return true;
}

/**
 * Валидирует структуру кэшированного списка аукционов.
 * @param obj Объект для проверки
 * @returns true если структура корректна
 */
export function validateAuctionsList(obj: unknown): obj is CacheAuctionsList {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const list = obj as Record<string, unknown>;
  if (!Array.isArray(list.auctions) || typeof list.pagination !== "object") {
    return false;
  }
  const pagination = list.pagination as Record<string, unknown>;
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
