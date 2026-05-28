export interface User {
  id: number
  email: string
  name: string | null
  balance: number
  createdAt: string
}

export interface Auction {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  startingPrice: number
  currentPrice: number
  sellerId: number
  seller: Pick<User, 'id' | 'name' | 'email'>
  winnerId: number | null
  winner: Pick<User, 'id' | 'name' | 'email'> | null
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  endsAt: string
  bids: Bid[]
  createdAt: string
}

export interface Bid {
  id: number
  auctionId: number
  userId: number
  user: Pick<User, 'id' | 'name' | 'email'>
  amount: number
  createdAt: string
}

export interface Payment {
  id: number
  userId: number
  auctionId: number
  amount: number
  stripePaymentId: string | null
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  refundReason?: string
  createdAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuctionsListResponse {
  auctions: Auction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials extends LoginCredentials {
  name: string
}

export interface CreateAuctionData {
  title: string
  description?: string
  imageUrl?: string
  startingPrice: number
  endsAt: string
}

export interface CreateBidData {
  amount: number
}

// Экспортируем все типы из advanced.ts
export * from './advanced';

// Экспортируем утилиты для WebSocket
export * from '../utils/websocket';