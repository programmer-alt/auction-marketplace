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
}

