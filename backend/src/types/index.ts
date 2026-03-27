import { Prisma } from "@prisma/client";

// ========================================
// Типы для User
// ========================================

export interface CreateUserData {
  email: string;
  password: string;
  name?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  balance?: Prisma.Decimal;
}

export type UserSelect = {
  id: number;
  email: string;
  name: string | null;
  balance: Prisma.Decimal;
  createdAt: Date;
};

// ========================================
// Типы для Auction
// ========================================

export type AuctionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

// Re-export Prisma namespace for convenience
export { Prisma } from "@prisma/client";

export interface AuctionWhereInput {
  status?: AuctionStatus;
  sellerId?: number;
}

export type AuctionWithRelations = Prisma.AuctionGetPayload<{
  include: {
    seller: { select: { id: true; email: true; name: true } };
    winner: { select: { id: true; email: true; name: true } };
    bids: {
      include: { user: { select: { id: true; email: true; name: true } } };
      orderBy: { amount: "desc" };
    };
    _count: { select: { bids: true } };
  };
}>;

// ========================================
// Типы для Bid
// ========================================

export interface CreateBidData {
  auctionId: number;
  userId: number;
  amount: Prisma.Decimal;
}

export type BidWithRelations = Prisma.BidGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
    auction: { select: { id: true; title: true; currentPrice: true } };
  };
}>;

export type BidSelect = Prisma.BidGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
  };
}>;

// ========================================
// Типы для Payment
// ========================================

export type PaymentStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface CreatePaymentData {
  userId: number;
  auctionId: number;
  amount: Prisma.Decimal;
  currency: string;
  stripePaymentId?: string;
  status: PaymentStatus;
}

export interface UpdatePaymentData {
  status?: PaymentStatus;
}

export type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    user: { select: { id: true; email: true; name: true } };
    auction: {
      select: { id: true; title: true; currentPrice: true; currency: true };
    };
  };
}>;

export type PaymentWithAuctionSeller = Prisma.PaymentGetPayload<{
  include: {
    auction: {
      select: {
        id: true;
        title: true;
        imageUrl: true;
        seller: { select: { id: true; name: true } };
      };
    };
  };
}>;

// ========================================
// Типы для Redis cache
// ========================================

export interface CacheAuction {
  id: number;
  title: string;
  startingPrice: number;
  sellerId: number;
  createdAt: string;
  endsAt: string;
  currentPrice?: number;
  currency?: string;
  status?: string;
}

export interface CacheAuctionsList {
  auctions: CacheAuction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ========================================
// Типы для API ответов
// ========================================

export interface ApiError {
  error: string;
}

export interface ApiSuccess<T> {
  message?: string;
  data?: T;
}

// ========================================
// Типы для JSON утилит
// ========================================

export type JsonReviver = (key: string, value: unknown) => unknown;
