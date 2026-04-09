import api from './axios'
import { Bid, CreateBidData } from '../types'

interface BidsListResponse {
  bids: Bid[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface CreateBidResponse {
  message: string
  bid: Bid
}

export const bidsApi = {
  getAuctionBids: async (auctionId: number) => {
    const response = await api.get<BidsListResponse>(`/auctions/${auctionId}/bids`)
    return response.data
  },

  createBid: async (auctionId: number, data: CreateBidData) => {
    const response = await api.post<CreateBidResponse>(`/auctions/${auctionId}/bids`, data)
    return response.data.bid
  },
}
