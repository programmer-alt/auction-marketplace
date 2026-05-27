import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { ArrowLeft, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { usePaymentData } from './hooks/usePaymentData';
import { useCardForm } from './hooks/useCardForm';
import AuctionSummary from './components/AuctionSummary';
import CardForm from './components/CardForm';

import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string)

function PaymentInner() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { auction, loading } = usePaymentData(id, user);
  const { processing, error, handlePayment } = useCardForm(auction);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
          <div className="h-10 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!auction) return null;

  return (
    <div className="max-w-lg mx-auto">
      <Link to={`/auctions/${id}`} className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Назад к аукциону
      </Link>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-100 p-3 rounded-full">
            <CreditCard className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Оплата</h1>
            <p className="text-gray-600 text-sm">Безопасная оплата через Stripe</p>
          </div>
        </div>

        <AuctionSummary auction={auction} />

        <CardForm
          processing={processing}
          currentPrice={auction.currentPrice}
          onSubmit={handlePayment}
          error={error}
        />


        <div className="mt-6 pt-6 border-t text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              SSL шифрование
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-4 w-4 text-green-500" />
              Безопасные платежи
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Payment() {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

  if (!publishableKey) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card">
          <h1 className="text-2xl font-bold mb-2">Stripe не настроен</h1>
          <p className="text-gray-600">Не задан VITE_STRIPE_PUBLISHABLE_KEY</p>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentInner />
    </Elements>
  )
}

