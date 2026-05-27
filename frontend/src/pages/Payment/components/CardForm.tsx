import React from 'react'
import { CheckCircle } from 'lucide-react'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { CardElement } from '@stripe/react-stripe-js'


interface CardFormProps {
  processing: boolean
  currentPrice: number
  onSubmit: (e: React.FormEvent) => void
  error?: string | null
}

const CardForm: React.FC<CardFormProps> = ({
  processing,
  currentPrice,
  onSubmit,
  error,
}) => (
  <form onSubmit={onSubmit} className="space-y-5">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Карта</label>
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <CardElement options={{
          style: {
            base: {
              fontSize: '14px',
              color: '#111827',
              '::placeholder': { color: '#6b7280' },
            },
            invalid: { color: '#dc2626' },
          },
          hidePostalCode: true,
        }} />
      </div>
    </div>

    {error ? (
      <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">{error}</div>
    ) : null}

    <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
      <p>
        🔒 Тестовый режим Stripe: используйте тестовые карты Stripe (в `test mode`).
      </p>
    </div>

    <button
      type="submit"
      disabled={processing}
      className="w-full btn-primary flex items-center justify-center gap-2"
    >
      {processing ? (
        <><LoadingSpinner /> Обработка...</>
      ) : (
        <><CheckCircle className="h-5 w-5" /> Оплатить ${currentPrice}</>
      )}
    </button>
  </form>
)

export default CardForm

