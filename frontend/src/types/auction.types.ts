/**
 * Типы для аукционов
 */

import { User, Bid } from './index';

// Основной интерфейс аукциона уже определен в index.ts
export type AuctionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export type AuctionStatusUnion = AuctionStatus;

export type AuctionByStatus<S extends AuctionStatusUnion> = Auction & { status: S };

export type ActiveAuction = AuctionByStatus<"ACTIVE">;

export type CompletedAuction = AuctionByStatus<"COMPLETED">;

export type CancelledAuction = AuctionByStatus<"CANCELLED">;

export type AuctionPreview = Pick<
  Auction,
  "id" | "title" | "imageUrl" | "currentPrice" | "status" | "endsAt" | "seller"
>;

export type AuctionDetail = Auction & {
  bids: Bid[];
  seller: User;
  winner: User | null;
};

export type AuctionState =
  | { type: "not_found" }
  | { type: "loading" }
  | { type: "active"; auction: ActiveAuction }
  | { type: "completed"; auction: CompletedAuction; winner: User | null }
  | { type: "cancelled"; auction: CancelledAuction; reason?: string };

export type AuctionEvent = `auction:${AuctionStatusUnion | "created" | "updated" | "deleted"}`;

export type AuctionFilters = {
  status?: AuctionStatusUnion | "ALL";
  minPrice?: number;
  maxPrice?: number;
  sellerId?: number;
  endsBefore?: DateLike;
  search?: string;
} & PaginationParams;

export type DateLike = Date | string | number;

export type TimeRange = {
  from: DateLike;
  to: DateLike;
};

export type DateFilter = {
  field: "createdAt" | "endsAt" | "updatedAt";
  range: TimeRange;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};