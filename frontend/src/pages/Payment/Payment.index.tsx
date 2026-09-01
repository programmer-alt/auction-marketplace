import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/store/auth.store";
import { ArrowLeft, CheckCircle, CreditCard } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import AuctionSummary from "./components/AuctionSummary";
import { usePaymentData } from "./hooks/usePaymentData";

import { paymentsApi } from "@/api/payments";
import { handleBusinessLogicError } from "@/utils/universalErrorHandler";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// ========================================
// Основной компонент страницы оплаты
// ========================================

function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { auction, loading: auctionLoading } = usePaymentData(id, user);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(true);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvcRef = useRef<HTMLDivElement>(null);
  const [elementsMounted, setElementsMounted] = useState(false);
  const isInitializing = useRef(false);
  const clientSecretRef = useRef<string | null>(null);

  // 1. Инициализируем Stripe.js v3 (из <script> тега)
  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY || stripeRef.current) return;

    const stripeFn = (window as any).Stripe;
    if (!stripeFn) {
      console.error("Stripe.js не загружен");
      setSecretError("Не удалось загрузить Stripe");
      setStripeLoaded(true);
      return;
    }

    try {
      const instance = stripeFn(STRIPE_PUBLISHABLE_KEY);
      stripeRef.current = instance;
      setStripeLoaded(true);
    } catch (err) {
      console.error("Failed to init Stripe:", err);
      setSecretError("Не удалось инициализировать Stripe");
      setStripeLoaded(true);
    }
  }, []);

  // 2. Создаём Elements и CardNumber/CardExpiry/CardCvc
  useEffect(() => {
    if (!stripeRef.current || !elementsMounted || elementsRef.current) return;

    console.log("[Payment] Mounting Stripe Elements...");

    try {
      const elements = stripeRef.current.elements();

      elements
        .create("cardNumber", {
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": { color: "#aab7c4" },
            },
            invalid: { color: "#9e2146" },
          },
        })
        .mount(cardNumberRef.current!);

      elements
        .create("cardExpiry", {
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": { color: "#aab7c4" },
            },
            invalid: { color: "#9e2146" },
          },
        })
        .mount(cardExpiryRef.current!);

      elements
        .create("cardCvc", {
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": { color: "#aab7c4" },
            },
            invalid: { color: "#9e2146" },
          },
        })
        .mount(cardCvcRef.current!);

      elementsRef.current = elements;
      console.log("[Payment] Stripe Elements mounted successfully");
    } catch (err) {
      console.error("Failed to create Stripe Elements:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeRef.current, elementsMounted]);

  // 3. Получаем clientSecret когда auction готов
  useEffect(() => {
    if (!auction || !stripeLoaded || isInitializing.current) return;

    let cancelled = false;

    if (clientSecret || secretError) {
      setSecretLoading(false);
      return;
    }

    isInitializing.current = true;

    paymentsApi
      .createPaymentIntent(auction.id)
      .then((res) => {
        if (!cancelled) {
          const secret = res.data?.clientSecret ?? null;
          setClientSecret(secret);
          clientSecretRef.current = secret;
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
        isInitializing.current = false;
      });

    return () => {
      cancelled = true;
      isInitializing.current = false;
    };
  }, [auction, stripeLoaded, clientSecret, secretError]);

  // 4. Обработчик платежа
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !stripeRef.current || !elementsRef.current) return;

    setProcessing(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripeRef.current.confirmCardPayment(
        clientSecretRef.current!,
        {
          payment_method: {
            card: elementsRef.current.getElement("cardNumber"),
          },
        },
      );

      if (stripeError) {
        setError(stripeError.message ?? "Ошибка подтверждения платежа");
        toast.error("Ошибка оплаты");
        return;
      }

      if (paymentIntent.status === "succeeded") {
        toast.success("Платёж успешно подтверждён");
        // Даем toast время на отображение перед редиректом
        setTimeout(() => {
          window.location.href = "/profile";
        }, 2000);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Ошибка оплаты. Попробуйте ещё раз.";
      setError(msg);
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  // Состояния загрузки
  if (auctionLoading || !stripeLoaded || secretLoading) {
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

  if (secretError && !clientSecret) {
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

  if (!auction) return null;

  return (
    <div className="max-w-lg mx-auto">
      <Link
        to={`/auctions/${auction.id}`}
        className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-6"
      >
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

        <form onSubmit={handlePayment} className="mt-8 space-y-5">
          <div data-testid="payment-method-container">
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер карты</label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div
                ref={(node) => {
                  cardNumberRef.current = node;
                  if (cardNumberRef.current && cardExpiryRef.current && cardCvcRef.current) {
                    setElementsMounted(true);
                  }
                }}
                className="stripe-element"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Срок действия</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div
                  ref={(node) => {
                    cardExpiryRef.current = node;
                    if (cardNumberRef.current && cardExpiryRef.current && cardCvcRef.current) {
                      setElementsMounted(true);
                    }
                  }}
                  className="stripe-element"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div
                  ref={(node) => {
                    cardCvcRef.current = node;
                    if (cardNumberRef.current && cardExpiryRef.current && cardCvcRef.current) {
                      setElementsMounted(true);
                    }
                  }}
                  className="stripe-element"
                />
              </div>
            </div>
          </div>

          {error ? (
            <div data-testid="payment-error" className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p>🔒 Тестовый режим Stripe: используйте тестовые карты Stripe (в `test mode`).</p>
          </div>

          <button
            data-testid="payment-submit"
            type="submit"
            disabled={processing}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <LoadingSpinner /> Обработка...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" /> Оплатить ${auction.currentPrice}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Payment() {
  return <PaymentPage />;
}
