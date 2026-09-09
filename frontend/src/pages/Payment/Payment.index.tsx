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

// Список стран для оплаты картой
const COUNTRIES = [
  { code: "US", name: "🇺🇸 США" },
  { code: "GB", name: "🇬🇧 Великобритания" },
  { code: "DE", name: "🇩🇪 Германия" },
  { code: "FR", name: "🇫🇷 Франция" },
  { code: "IT", name: "🇮🇹 Италия" },
  { code: "ES", name: "🇪🇸 Испания" },
  { code: "NL", name: "🇳🇱 Нидерланды" },
  { code: "BE", name: "🇧🇪 Бельгия" },
  { code: "AT", name: "🇦🇹 Австрия" },
  { code: "PT", name: "🇵🇹 Португалия" },
  { code: "IE", name: "🇮🇪 Ирландия" },
  { code: "LU", name: "🇱🇺 Люксембург" },
  { code: "FI", name: "🇫🇮 Финляндия" },
  { code: "SE", name: "🇸🇪 Швеция" },
  { code: "DK", name: "🇩🇰 Дания" },
  { code: "PL", name: "🇵🇱 Польша" },
  { code: "CZ", name: "🇨🇿 Чехия" },
  { code: "RO", name: "🇷🇴 Румыния" },
  { code: "BG", name: "🇧🇬 Болгария" },
  { code: "GR", name: "🇬🇷 Греция" },
  { code: "HR", name: "🇭🇷 Хорватия" },
  { code: "SK", name: "🇸🇰 Словакия" },
  { code: "SI", name: "🇸🇮 Словения" },
  { code: "LT", name: "🇱🇹 Литва" },
  { code: "LV", name: "🇱🇻 Латвия" },
  { code: "EE", name: "🇪🇪 Эстония" },
  { code: "RU", name: "🇷🇺 Россия" },
  { code: "UA", name: "🇺🇦 Украина" },
  { code: "BY", name: "🇧🇾 Беларусь" },
  { code: "KZ", name: "🇰🇿 Казахстан" },
  { code: "UZ", name: "🇺🇿 Узбекистан" },
  { code: "GE", name: "🇬🇪 Грузия" },
  { code: "AM", name: "🇦🇲 Армения" },
  { code: "AZ", name: "🇦🇿 Азербайджан" },
  { code: "MD", name: "🇲🇩 Молдова" },
  { code: "JP", name: "🇯🇵 Япония" },
  { code: "KR", name: "🇰🇷 Южная Корея" },
  { code: "CN", name: "🇨🇳 Китай" },
  { code: "IN", name: "🇮🇳 Индия" },
  { code: "BR", name: "🇧🇷 Бразилия" },
  { code: "CA", name: "🇨🇦 Канада" },
  { code: "AU", name: "🇦🇺 Австралия" },
  { code: "SG", name: "🇸🇬 Сингапур" },
  { code: "MY", name: "🇲🇾 Малайзия" },
  { code: "TH", name: "🇹🇭 Таиланд" },
  { code: "PH", name: "🇵🇭 Филиппины" },
  { code: "ID", name: "🇮🇩 Индонезия" },
  { code: "VN", name: "🇻🇳 Вьетнам" },
  { code: "TR", name: "🇹🇷 Турция" },
  { code: "AE", name: "🇦🇪 ОАЭ" },
  { code: "SA", name: "🇸🇦 Саудовская Аравия" },
  { code: "IL", name: "🇮🇱 Израиль" },
  { code: "ZA", name: "🇿🇦 ЮАР" },
  { code: "MX", name: "🇲🇽 Мексика" },
  { code: "AR", name: "🇦🇷 Аргентина" },
  { code: "CL", name: "🇨🇱 Чили" },
  { code: "CO", name: "🇨🇴 Колумбия" },
  { code: "OTHER", name: "🌍 Другая" },
] as const;

// ========================================
// Основной компонент страницы оплаты
// ========================================

function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { auction, loading: auctionLoading } = usePaymentData(id, user);

  const [secretLoading, setSecretLoading] = useState(true);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("US");

  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [elementsMounted, setElementsMounted] = useState(false);
  const isInitializing = useRef(false);
  const clientSecretRef = useRef<string | null>(null);
  const paymentDebounceRef = useRef(false);
  const lastPaymentIntentIdRef = useRef<string | null>(null);

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

  // 2. Создаём единый Card Element с postal code
  useEffect(() => {
    if (!stripeRef.current || !elementsMounted || elementsRef.current) return;

    console.log("[Payment] Mounting Stripe Elements...");

    try {
      const elements = stripeRef.current.elements();

      elements
        .create("card", {
          style: {
            base: {
              fontSize: "16px",
              color: "#424770",
              "::placeholder": { color: "#aab7c4" },
            },
            invalid: { color: "#9e2146" },
          },
          hidePostalCode: false,
        })
        .mount(cardContainerRef.current!);

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

    if (clientSecretRef.current || secretError) {
      setSecretLoading(false);
      return;
    }

    isInitializing.current = true;

    paymentsApi
      .createPaymentIntent(auction.id, selectedCountry) // Передаем selectedCountry
      .then((res) => {
        if (!cancelled) {
          const secret = res.data?.clientSecret ?? null;
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
  }, [auction, stripeLoaded, secretError, selectedCountry]); // Добавляем selectedCountry в зависимости

  // 4. Обработчик платежа — полная обработка всех сценариев Stripe
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auction || !stripeRef.current || !elementsRef.current) return;
    if (processing || paymentDebounceRef.current) return;

    setProcessing(true);
    setError(null);
    paymentDebounceRef.current = true;

    // Idempotency guard: блокируем повторный вызов тем же PI
    const currentSecret = clientSecretRef.current;
    if (!currentSecret || typeof currentSecret !== 'string') {
      const msg = "Невозможно подтвердить платёж: недействительный секретный ключ.";
      setError(msg);
      toast.error(msg);
      setProcessing(false);
      paymentDebounceRef.current = false;
      return;
    }

    // Усиленная валидация формата Stripe PaymentIntent client secret
    const piIdMatch = currentSecret.match(/^(pi_[a-zA-Z0-9]+)_secret_([a-zA-Z0-9]+)$/);
    if (!piIdMatch) {
      const msg = "Невозможно подтвердить платёж: недействительный формат ключа Stripe.";
      setError(msg);
      toast.error(msg);
      setProcessing(false);
      paymentDebounceRef.current = false;
      return;
    }

    const piId = piIdMatch[1];
    if (lastPaymentIntentIdRef.current === piId) {
      toast("Платёж уже обрабатывается, пожалуйста, подождите...", { icon: "ℹ️" });
      setProcessing(false);
      paymentDebounceRef.current = false;
      return;
    }
    lastPaymentIntentIdRef.current = piId;

    try {
      const cardElement = elementsRef.current.getElement("card");
      
      const { error: stripeError, paymentIntent } = await stripeRef.current.confirmCardPayment(
        clientSecretRef.current!,
        {
          payment_method: {
            card: cardElement,
            billing_details: { // Можно добавить, если нужно
              address: {
                country: selectedCountry // Передаем выбранную страну
              }
            }
          },
        },
      );

      // Сценарий 1: Ошибка валидации/отклонения от Stripe
      if (stripeError) {
        const errorMsg = formatStripeError(stripeError);
        setError(errorMsg);
        toast.error(errorMsg);
        return;
      }

      // Сценарий 2: Нет paymentIntent — непредвиденная ошибка
      if (!paymentIntent) {
        const msg = "Не получен статус платежа от Stripe";
        setError(msg);
        toast.error(msg);
        return;
      }

      // Сценарий 3: Обработка по статусу PaymentIntent
      switch (paymentIntent.status) {
        case "succeeded": {
          toast.success("Платёж успешно подтверждён!");
          setTimeout(() => {
            window.location.href = "/profile";
          }, 2000);
          break;
        }

        case "requires_payment_method": {
          const msg =
            paymentIntent.last_payment_error?.message ??
            "Платёж отклонён. Карта заблокирована или не активна для онлайн-оплаты.";
          setError(msg);
          toast.error(msg);
          lastPaymentIntentIdRef.current = null;
          break;
        }

        case "requires_action": {
          const msg =
            paymentIntent.last_payment_error?.message ??
            "Требуется дополнительная верификация банка (3D Secure). Попробуйте другую карту или свяжитесь с банком.";
          setError(msg);
          toast.error(msg);
          lastPaymentIntentIdRef.current = null;
          break;
        }

        case "processing": {
          const msg = "Платёж обрабатывается банком. Результат будет указан в течение нескольких минут.";
          setError(msg);
          toast(msg, { icon: "⏳", duration: 5000 });
          setTimeout(() => {
            window.location.href = "/profile";
          }, 3000);
          break;
        }

        case "requires_confirmation": {
          const msg = paymentIntent.last_payment_error?.message ?? "Платёж требует подтверждения. Попробуйте ещё раз.";
          setError(msg);
          toast.error(msg);
          lastPaymentIntentIdRef.current = null;
          break;
        }

        case "canceled": {
          const msg = "Платёж отменён. Средств на карте недостаточно или операция запрещена.";
          setError(msg);
          toast.error(msg);
          lastPaymentIntentIdRef.current = null;
          break;
        }

        default: {
          const msg = `Платёж в статусе: ${paymentIntent.status}. Ожидается обработка.`;
          setError(msg);
          toast(msg, { icon: "ℹ️", duration: 5000 });
          setTimeout(() => {
            window.location.href = "/profile";
          }, 3000);
        }
      }
    } catch (err: any) {
      console.error("[Payment] confirmCardPayment error object:", err); // Логируем объект ошибки
      console.error("[Payment] Error details:", {
        message: err?.message,
        code: err?.code,
        type: err?.type,
        stripeError: err?.stripeError,
        name: err?.name, // Добавим имя ошибки, например TypeError
      });

      // Специальная обработка payment_intent_unexpected_state
      // Возникает когда PI уже в неправильном состоянии (например, уже requires_capture)
      if (err?.stripeError?.code === "payment_intent_unexpected_state") {
        console.warn("[Payment] PI unexpected state — retrieving current state from Stripe...");
        try {
          const piId = clientSecretRef.current?.split("_")[2]; // pi_XXX_secret_YYY
          if (piId) {
            // Извлекаем stripePaymentId из clientSecret (pi_...)
            const piMatch = clientSecretRef.current?.match(/^(pi_[a-zA-Z0-9]+)/);
            if (piMatch) {
              const currentPI = await stripeRef.current.paymentIntents.retrieve(piMatch[1]);
              console.log("[Payment] Current PI state:", currentPI.status);

              if (currentPI.status === "requires_capture") {
                // Оплата уже обработана — холд создан
                toast.success("Платёж авторизован! Средства зарезервированы на карте.");
                setTimeout(() => {
                  window.location.href = "/profile";
                }, 2000);
                return;
              }

              if (currentPI.status === "succeeded") {
                toast.success("Платёж уже был успешно совершён ранее.");
                setTimeout(() => {
                  window.location.href = "/profile";
                }, 2000);
                return;
              }

              if (currentPI.status === "canceled" || currentPI.status === "payment_intent_invalid") {
                const msg = "Платёж отменён. Попробуйте ещё раз или обновите страницу.";
                setError(msg);
                toast.error(msg);
                return;
              }
            }
          }
        } catch (retrieveErr) {
          console.error("[Payment] Failed to retrieve PI state:", retrieveErr);
        }
      }

      // Проверяем, была ли ошибка типа card_declined передана напрямую в err
      let errorMessage = "Ошибка оплаты. Попробуйте ещё раз.";
      if (err?.code === 'card_declined') {
        errorMessage = "Платёж отклонён банком. Проверьте данные карты или используйте другую.";
      } else if (err?.stripeError?.message) {
        errorMessage = err.stripeError.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.toString) {
        // Пытаемся получить строковое представление объекта ошибки, например, "TypeError: ..."
        errorMessage = `Ошибка оплаты: ${err.toString()}`;
      } else {
        // Если всё остальное не сработало, используем общее сообщение
        errorMessage = "Ошибка оплаты. Попробуйте ещё раз.";
      }

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
      paymentDebounceRef.current = false;
    }
  };

  // Форматирование ошибок Stripe в понятные сообщения
  function formatStripeError(error: { type?: string; code?: string; message?: string }): string {
    const code = error.code;
    const type = error.type;

    // Недостаточно средств
    if (code === "insufficient_funds") {
      return "На карте недостаточно средств. Пополните счёт или используйте другую карту.";
    }

    // Карта заблокирована / запрещены онлайн-платежи
    if (code === "card_held" || code === "lost_card" || code === "stolen_card") {
      return "Карта заблокирована. Свяжитесь с банком для разблокировки.";
    }

    // Недостаточно информации (не заполнены данные)
    if (code === "missing") {
      return "Недостаточно данных для оплаты. Проверьте номер карты, срок и CVC.";
    }

    // Отклонена банком
    if (code === "processing_error" || code === "call_issuer") {
      return "Ошибка обработки банком-эмитентом. Попробуйте через 5 минут или свяжитесь с банком.";
    }

    // 3D Secure не прошёл
    if (code === "authentication_required") {
      return "Верификация банка не пройдена. Попробуйте другую карту или свяжитесь с банком.";
    }

    // Просрочена карта
    if (code === "expired_card") {
      return "Срок действия карты истёк. Используйте другую карту.";
    }

    // Недостаточно информации
    if (code === "incorrect_cvc") {
      return "Неверный CVC код. Проверьте последние 3 цифры на обороте карты.";
    }

    if (code === "incorrect_zip") {
      return "Неверный почтовый индекс. Введите индекс, указанный в договоре с банком.";
    }

    // Generic decline
    if (code === "card_declined" || type === "card_error") {
      return "Платёж отклонён банком. Проверьте данные карты или используйте другую.";
    }

    // По умолчанию — сообщение от Stripe
    return error.message ?? "Ошибка оплаты. Попробуйте ещё раз.";
  }

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

  if (secretError && !clientSecretRef.current) {
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
          <div data-testid="country-selector">
            <label htmlFor="country-select" className="block text-sm font-medium text-gray-700 mb-1">
              Страна карты
            </label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
            >
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>

          <div data-testid="payment-method-container">
            <label className="block text-sm font-medium text-gray-700 mb-1">Номер карты, срок действия и CVC</label>
            <div
              ref={(node) => {
                cardContainerRef.current = node;
                if (cardContainerRef.current) {
                  setElementsMounted(true);
                }
              }}
              className="border border-gray-300 rounded-lg p-3"
            />
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
