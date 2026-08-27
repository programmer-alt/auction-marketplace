import type { AuctionsListResponse, CreateAuctionData } from "../types";
import type { ApiResponse, Auction, AuctionDetail, ExtractApiData } from "../types/advanced";
import api from "./axios";

interface AuctionMutationResponse {
  message: string;
  auction: Auction;
}

export const auctionsApi = {
  getAuctions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<AuctionsListResponse>> => {
    const response = await api.get<AuctionsListResponse>("/auctions", { params });
    return {
      success: true,
      data: response.data,
    } as ApiResponse<AuctionsListResponse>;
  },

  getAuctionById: async (id: number, signal?: AbortSignal): Promise<ApiResponse<AuctionDetail>> => {
    const response = await api.get<{ auction: Auction }>(`/auctions/${id}`, { signal });
    return {
      success: true,
      data: response.data.auction as AuctionDetail,
    } as ApiResponse<AuctionDetail>;
  },

  createAuction: async (data: CreateAuctionData): Promise<ApiResponse<Auction>> => {
    const response = await api.post<AuctionMutationResponse>("/auctions", data);
    return {
      success: true,
      data: response.data.auction,
    } as ApiResponse<Auction>;
  },

  updateAuction: async (id: number, data: Partial<CreateAuctionData>): Promise<ApiResponse<Auction>> => {
    const response = await api.put<AuctionMutationResponse>(`/auctions/${id}`, data);
    return {
      success: true,
      data: response.data.auction,
    } as ApiResponse<Auction>;
  },

  // ponytail: сбрасываем Content-Type в undefined, чтобы FormData мог установить multipart/form-data с boundary
  uploadImage: async (file: File): Promise<ApiResponse<string>> => {
    const formData = new FormData();
    formData.append("image", file);
    const response = await api.post<{ imageUrl: string }>("/upload", formData, {
      headers: {
        "Content-Type": undefined,
      },
    });
    return {
      success: true,
      data: response.data.imageUrl,
    } as ApiResponse<string>;
  },

  deleteAuction: async (id: number): Promise<ApiResponse<{ message: string }>> => {
    const response = await api.delete(`/auctions/${id}`);
    return {
      success: true,
      data: response.data,
    } as ApiResponse<{ message: string }>;
  },

  completeAuction: async (id: number): Promise<ApiResponse<{ message: string; auction: Auction }>> => {
    const response = await api.post<AuctionMutationResponse>(`/auctions/${id}/complete`);
    return {
      success: true,
      data: response.data,
    } as ApiResponse<{ message: string; auction: Auction }>;
  },
};

// Функция-утилита для извлечения данных из API-ответа
export function extractAuctionData(response: ApiResponse<Auction>): Auction | null {
  if (response.success) {
    return response.data;
  }
  return null;
}

// Функция-утилита для извлечения данных из любого API-ответа с использованием ExtractApiData
export function extractData<T>(response: ApiResponse<T>): T | null {
  if (response.success) {
    return response.data;
  }
  return null;
}

// Улучшенная функция извлечения данных с использованием ExtractApiData
export function extractApiData<T extends ApiResponse<any>>(response: T): ExtractApiData<T> | null {
  if (response.success) {
    return response.data;
  }
  return null;
}

// Утилиты для проверки типа ответа
export { isApiSuccess, isApiError } from "../types/advanced";
