import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { Auction } from '@/types'
import { useStripe, useElements } from '@stripe/react-stripe-js'
import { markErrorAsHandled } from '@/utils/errorHandler'

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

    setProcessing(true)
    setError(null)

    try {
      // clientSecret уже получен в Payment.index.tsx и передан в Elements
      // Подтверждаем платёж через PaymentElement
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/result`,
        },
        redirect: 'if_required',
      })

      if (submitError) {
        setError(submitError.message ?? 'Ошибка подтверждения платежа')
        toast.error('Ошибка оплаты')
        return
      }

      // Если redirect не требуется — платёж успешен
      toast.success('Платёж успешно подтверждён')
      navigate('/profile')
    } catch (err: any) {
      const msg = err?.message ?? 'Ошибка оплаты. Попробуйте ещё раз.'
      setError(msg)
      toast.error(msg)
      // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
      markErrorAsHandled(err);
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