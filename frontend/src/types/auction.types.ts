/**
 * Auction-related types
 */

import type { Auction, Bid, User } from "./index";

// Re-export Auction for convenience — allows direct imports from auction.types
// Note: Auction is also available via barrel export from '@/types'
export type { Auction } from "./index";

// ========================================
// Статусы и типы аукционов
// ========================================

/**
 * Статусы аукциона как union тип
 */
export type AuctionStatusUnion = Auction["status"];

/**
 * Тип для фильтрации аукционов по статусу
 */
export type AuctionByStatus<S extends AuctionStatusUnion> = Auction & { status: S };

/**
 * Тип для активных аукционов
 */
export type ActiveAuction = AuctionByStatus<"ACTIVE">;

/**
 * Тип для завершенных аукционов
 */
export type CompletedAuction = AuctionByStatus<"COMPLETED">;

/**
 * Тип для отмененных аукционов
 */
export type CancelledAuction = AuctionByStatus<"CANCELLED">;

/**
 * Тип для аукциона с минимальными данными (для списков)
 */
export type AuctionPreview = Pick<
  Auction,
  "id" | "title" | "imageUrl" | "currentPrice" | "status" | "endsAt" | "seller"
>;

/**
 * Тип для детального представления аукциона
 */
export type AuctionDetail = Auction & {
  bids: Bid[];
  seller: User;
  winner: User | null;
};

// ========================================
// Состояние аукциона (discriminated union)
// ========================================

/**
 * Тип для состояния аукциона с discriminated union
 */
export type AuctionState =
  | { type: "not_found" }
  | { type: "loading" }
  | { type: "active"; auction: ActiveAuction }
  | { type: "completed"; auction: CompletedAuction; winner: User | null }
  | { type: "cancelled"; auction: CancelledAuction; reason?: string };

// ========================================
// Type guards для аукционов
// ========================================

/**
 * Type guard для проверки активного аукциона
 */
export function isActiveAuction(auction: Auction): auction is ActiveAuction {
  return auction.status === "ACTIVE";
}

/**
 * Type guard для проверки завершенного аукциона
 */
export function isCompletedAuction(auction: Auction): auction is CompletedAuction {
  return auction.status === "COMPLETED";
}
