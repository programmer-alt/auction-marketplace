/**
 * Типы для ставок
 */

import { Auction, User } from './index';

export type BidCreate = Omit<Bid, "id" | "createdAt" | "user"> & {
  userId: number;
};

export type BidWithAuction = Bid & {
  auction: Pick<Auction, "id" | "title" | "currentPrice" | "status">;
};

export type BidEvent = `bid:${"created" | "updated" | "deleted" | "won"}`;