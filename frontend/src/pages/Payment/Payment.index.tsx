import { useAuthStore } from "@/store/auth.store";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import AuctionSummary from "./components/AuctionSummary";
import CardForm from "./components/CardForm";
import { useCardForm } from "./hooks/useCardForm";
import { usePaymentData } from "./hooks/usePaymentData";

import { paymentsApi } from "@/api/payments";
import { handleBusinessLogicError } from "@/utils/universalErrorHandler";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

function PaymentInner() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { auction, loading } = usePaymentData(id, user);
  const { processing, error, handlePayment } = useCardForm(auction);

  // Получаем clientSecret для PaymentElement
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(true);
  const [secretError, setSecretError] = useState<string | null>(null);

  // Добавляем ref для отслеживания состояния загрузки и предотвращения дублирующихся вызовов
  const isFetchingSecret = useRef(false);

  useEffect(() => {
    if (!auction || isFetchingSecret.current) return;

    let cancelled = false;

    // Проверяем, что у нас еще нет clientSecret для этого аукциона или уже произошла ошибка
    if (clientSecret || secretError) {
      setSecretLoading(false);
      return;
    }

    // Устанавливаем флаг, что запрос уже выполняется
    isFetchingSecret.current = true;

    paymentsApi
      .createPaymentIntent(auction.id)
      .then((res) => {
        if (!cancelled) {
          setClientSecret(res.data?.clientSecret ?? null);
          setSecretLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const errorMessage = err?.response?.data?.message ?? "Не удалось инициализировать платёж";
          setSecretError(errorMessage);
          handleBusinessLogicError(err, {
            auctionId: auction.id,
            context: "payment-intent-creation",
            originalError: err,
          });
          setSecretLoading(false);
        }
      })
      .finally(() => {
        // Сбрасываем флаг после завершения запроса
        isFetchingSecret.current = false;
      });

    return () => {
      cancelled = true;
      // Сбрасываем флаг при размонтировании компонента
      isFetchingSecret.current = false;
    };
  }, [auction, clientSecret]);

  if (loading || secretLoading) {
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

  if (secretError) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card">
          <div className="bg-red-50 rounded-lg p-4 text-red-700">{secretError}</div>
          <Link
            to={`/auctions/${id}`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад к аукциону
          </Link>
        </div>
      </div>
    );
  }

  if (!clientSecret) return null;

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
            <h1 data-testid="payment-title" className="text-2xl font-bold">
              Оплата
            </h1>
            <p className="text-gray-600 text-sm">Безопасная оплата через Stripe</p>
          </div>
        </div>

        <AuctionSummary auction={auction} />

        <div className="mt-8">
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: { theme: "stripe" },
            }}
          >
            <CardForm
              processing={processing}
              currentPrice={auction.currentPrice}
              onSubmit={handlePayment}
              error={error}
            />
          </Elements>
        </div>
      </div>
    </div>
  );
}

export default function Payment() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentInner />
    </Elements>
  );
}
