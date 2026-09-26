export interface User {
  id: number;
  email: string;
  name: string | null;
  balance: number;
  createdAt: string;
}

export interface Auction {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startingPrice: number;
  currentPrice: number | null;
  sellerId: number;
  seller: Pick<User, "id" | "name" | "email">;
  winnerId: number | null;
  winner: Pick<User, "id" | "name" | "email"> | null;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  endsAt: string;
  bids: Bid[];
  createdAt: string;
  currency: string;
}

export interface Bid {
  id: number;
  auctionId: number;
  userId: number;
  user: Pick<User, "id" | "name" | "email">;
  amount: number;
  createdAt: string;
}

export interface Payment {
  id: number;
  userId: number;
  auctionId: number;
  amount: number;
  stripePaymentId: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  refundReason?: string;
  createdAt: string;
}

export interface AuctionsListResponse {
  auctions: Auction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
}

export interface CreateAuctionData {
  title: string;
  description?: string;
  imageUrl?: string;
  startingPrice: number;
  endsAt: string;
}

export interface CreateBidData {
  amount: number;
}

// Экспортируем модульные типы
export * from "./api.types";
export * from "./error.types";
export * from "./auction.types";
export * from "./payment.types";
export * from "./user.types";
export * from "./bid.types";
export * from "./async.types";
export * from "./form.types";
export * from "./event.types";
export * from "./date.types";
export * from "./react.types";
export * from "./object.types";
export * from "./utility.types";
export * from "./auth.types";

// Экспортируем утилиты для WebSocket
export * from "../utils/websocket";
