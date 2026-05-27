import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { Auction } from '../../../types'
import { paymentsApi } from '../../../api/payments'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'

export const useCardForm = (auction: Auction | null) => {
  const navigate = useNavigate()
  const stripe = useStripe()
  const elements = useElements()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auction) return

    if (!stripe || !elements) {
      toast.error('Stripe еще не инициализирован')
      return
    }

    const card = elements.getElement(CardElement)
    if (!card) {
      toast.error('Карточные данные не найдены')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const result = await paymentsApi.createPaymentIntent(auction.id)
      if (!result.data?.clientSecret) {
        throw new Error('Не удалось получить clientSecret')
      }

      const { clientSecret } = result.data

      const confirmation = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        },
      })

      if (confirmation.error) {
        setError(confirmation.error.message ?? 'Ошибка подтверждения платежа')
        toast.error('Ошибка оплаты')
        return
      }

      if (confirmation.paymentIntent?.status === 'succeeded') {
        toast.success('Платеж успешно подтвержден')
        navigate('/profile')
        return
      }

      toast.success('Платеж обрабатывается')
    } catch (err: any) {
      const msg = err?.message ?? 'Ошибка оплаты. Попробуйте ещё раз.'
      setError(msg)
      toast.error(msg)
    } finally {
      setProcessing(false)
    }
  }

  return {
    processing,
    error,
    handlePayment,
  }
}

