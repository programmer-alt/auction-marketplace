import api from './axios'
import { Bid, CreateBidData } from '../types'

export const bidsApi = {
  getAuctionBids: async (auctionId: number) => {
    const response = await api.get<Bid[]>(`/auctions/${auctionId}/bids`)
    return response.data
  },

  createBid: async (auctionId: number, data: CreateBidData) => {
    const response = await api.post<Bid>(`/auctions/${auctionId}/bids`, data)
    return response.data
  },
}