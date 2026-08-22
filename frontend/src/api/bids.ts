import type { Bid, CreateBidData } from "../types";
import api from "./axios";

interface BidsListResponse {
  bids: Bid[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateBidResponse {
  message: string;
  bid: Bid;
}

export const bidsApi = {
  getAuctionBids: async (auctionId: number, signal?: AbortSignal) => {
    const response = await api.get<BidsListResponse>(`/auctions/${auctionId}/bids`, { signal });
    return response.data;
  },

  createBid: async (auctionId: number, data: CreateBidData) => {
    const response = await api.post<CreateBidResponse>(`/auctions/${auctionId}/bids`, data);
    return response.data.bid;
  },
};
