import api from './axios'
import { Auction, AuctionsListResponse, CreateAuctionData } from '../types'

export const auctionsApi = {
  getAuctions: async (params?: {
    page?: number
    limit?: number
    status?: string
    search?: string
  }) => {
    const response = await api.get<AuctionsListResponse>('/auctions', { params })
    return response.data
  },

  getAuctionById: async (id: number) => {
    const response = await api.get<{ auction: Auction }>(`/auctions/${id}`)
    return response.data.auction
  },

  createAuction: async (data: CreateAuctionData) => {
    const response = await api.post<Auction>('/auctions', data)
    return response.data
  },

  updateAuction: async (id: number, data: Partial<CreateAuctionData>) => {
    const response = await api.put<Auction>(`/auctions/${id}`, data)
    return response.data
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)
    const response = await api.post<{ imageUrl: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.imageUrl
  },

  deleteAuction: async (id: number) => {
    const response = await api.delete(`/auctions/${id}`)
    return response.data
  },
}