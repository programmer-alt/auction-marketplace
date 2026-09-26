/**
 * Payment-related types
 */

import type { Auction, Payment } from "./index";

/**
 * Статусы платежа как union тип
 */
export type PaymentStatusUnion = Payment["status"];

/**
 * Тип для платежа с деталями аукциона
 */
export type PaymentWithAuction = Payment & {
  auction: Pick<Auction, "id" | "title" | "imageUrl" | "sellerId">;
};
