import api from './axios'
import { Auction, PaginatedResponse, CreateAuctionData } from '../types'

export const auctionsApi = {
  getAuctions: async (params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
  }) => {
    const response = await api.get<PaginatedResponse<Auction>>('/auctions', { params })
    return response.data
  },

  getAuctionById: async (id: number) => {
    const response = await api.get<Auction>(`/auctions/${id}`)
    return response.data
  },

  createAuction: async (data: CreateAuctionData) => {
    const response = await api.post<Auction>('/auctions', data)
    return response.data
  },

  updateAuction: async (id: number, data: Partial<CreateAuctionData>) => {
    const response = await api.put<Auction>(`/auctions/${id}`, data)
    return response.data
  },

  deleteAuction: async (id: number) => {
    const response = await api.delete(`/auctions/${id}`)
    return response.data
  },
}