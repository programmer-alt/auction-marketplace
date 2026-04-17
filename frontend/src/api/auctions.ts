import api from './axios'
import { Auction, AuctionsListResponse, CreateAuctionData } from '../types'

interface AuctionMutationResponse {
  message: string
  auction: Auction
}

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

  getAuctionById: async (id: number, signal?: AbortSignal) => {
    const response = await api.get<{ auction: Auction }>(`/auctions/${id}`, { signal })
    return response.data.auction
  },

  createAuction: async (data: CreateAuctionData) => {
    const response = await api.post<AuctionMutationResponse>('/auctions', data)
    return response.data.auction
  },

  updateAuction: async (id: number, data: Partial<CreateAuctionData>) => {
    const response = await api.put<AuctionMutationResponse>(`/auctions/${id}`, data)
    return response.data.auction
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
