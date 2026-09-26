/**
 * Bid-related types
 */

import type { Auction, Bid } from "./index";

/**
 * Тип для создания ставки (без id и временных меток)
 */
export type BidCreate = Omit<Bid, "id" | "createdAt" | "user"> & {
  userId: number;
};

/**
 * Тип для ставки с расширенной информацией об аукционе
 */
export type BidWithAuction = Bid & {
  auction: Pick<Auction, "id" | "title" | "currentPrice" | "status">;
};
