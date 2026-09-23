/**
 * Типы для платежей
 */

import { Auction } from './index';

// PaymentStatus уже определен в основном интерфейсе Payment
export type PaymentStatusUnion = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export type PaymentWithAuction = Payment & {
  auction: Pick<Auction, "id" | "title" | "imageUrl" | "sellerId">;
};