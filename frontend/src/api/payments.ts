import api from './axios'
import type { ApiResponse, Payment } from '../types'

export interface CreatePaymentIntentResponse {
  message: string
  clientSecret: string
  payment: Payment
}

export const paymentsApi = {
  createPaymentIntent: async (auctionId: number): Promise<ApiResponse<CreatePaymentIntentResponse>> => {
    const response = await api.post<CreatePaymentIntentResponse>('/payments/create-intent', { auctionId })
    return {
      success: true,
      data: response.data,
    } as ApiResponse<CreatePaymentIntentResponse>
  },

  getMyPayments: async (params?: { page?: number; limit?: number }): Promise<ApiResponse<{ payments: Payment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>> => {
    const response = await api.get('/payments/my', { params })
    return {
      success: true,
      data: response.data,
    } as ApiResponse<{ payments: Payment[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>
  },

  refundPayment: async (paymentId: number, reason?: string): Promise<ApiResponse<{ message: string; payment: Payment }>> => {
    const response = await api.post<{ message: string; payment: Payment }>(`/payments/${paymentId}/refund`, { reason })
    return {
      success: true,
      data: response.data,
    } as ApiResponse<{ message: string; payment: Payment }>
  },
}

