import { useAuthStore } from "@/store/auth.store";
import { ArrowLeft, CreditCard } from "lucide-react";
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
  const [processing, setProcessing] = useState(false); // Используем setProcessing
  const [error, setError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState("US");

  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const cardElementRef = useRef<any>(null); // Добавим ref для cardElement
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [elementsMounted] = useState(true);
  const isInitializing = useRef(false);
  const clientSecretRef = useRef<string | null>(null);
  const lastPaymentIntentIdRef = useRef<string | null>(null);

  // Сбрасываем clientSecret при смене страны, чтобы создать новый PaymentIntent с корректной страной
  useEffect(() => {
    if (clientSecretRef.current) {
      console.log("[Payment] Country changed, resetting clientSecret for new PaymentIntent");
      clientSecretRef.current = null;
      setSecretError(null);
    }
  }, [selectedCountry]);

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

      // Создаём CardElement и сохраняем ссылку
      const card = elements.create("card", {
        style: {
          base: {
            fontSize: "16px",
            color: "#424770",
            "::placeholder": { color: "#aab7c4" },
          },
          invalid: { color: "#9e2146" },
        },
        hidePostalCode: false,
      });

      card.mount(cardContainerRef.current!);
      cardElementRef.current = card; // Сохраняем ссылку на cardElement

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

  // Функция для извлечения ID PaymentIntent из clientSecret
  const extractPaymentIntentId = (clientSecret: string): string => {
    return clientSecret.split('_secret_')[0];
  };

  // 4. Обработчик платежа — полная обработка всех сценариев Stripe
  const handlePayment = async () => {
    if (!cardElementRef.current || !clientSecretRef.current) return; // Используем cardElementRef.current

    const piId = extractPaymentIntentId(clientSecretRef.current);
    if (lastPaymentIntentIdRef.current === piId) {
      toast.error("Повторная оплата не разрешена.");
      return;
    }

    setProcessing(true); // Используем setProcessing
    setError(null);

    let paymentIntentResult = null; // Объявляем переменную вне try

    try {
      // 1. Подтверждаем PaymentIntent
      const { error: stripeError, paymentIntent } = await stripeRef.current!.confirmCardPayment(
        clientSecretRef.current,
        {
          payment_method: {
            card: cardElementRef.current, // Используем cardElementRef.current
            billing_details: {
              address: {
                country: selectedCountry, // Передаем страну
              },
            },
          },
        },
      );

      // 2. Проверяем наличие ошибки Stripe
      if (stripeError) {
        console.error("Ошибка Stripe:", stripeError);
        let msg = "Неизвестная ошибка при оплате.";

        switch (stripeError.type) {
          case "card_error":
            msg = stripeError.message || msg;
            break;
          case "validation_error":
            msg = stripeError.message || msg;
            break;
          case "payment_intent_invalid_parameter":
            if (stripeError.param === "payment_method_data[card][number]") {
              msg = "Некорректный номер карты.";
            } else if (stripeError.param === "payment_method_data[card][exp_month]") {
              msg = "Некорректный месяц истечения срока действия карты.";
            } else if (stripeError.param === "payment_method_data[card][exp_year]") {
              msg = "Некорректный год истечения срока действия карты.";
            } else if (stripeError.param === "payment_method_data[card][cvc]") {
              msg = "Некорректный CVC/CVV код.";
            } else if (stripeError.param === "payment_method_data[billing_details][address][line1]") {
              msg = "Некорректный адрес (улица).";
            } else if (stripeError.param === "payment_method_data[billing_details][address][city]") {
              msg = "Некорректный город.";
            } else if (stripeError.param === "payment_method_data[billing_details][address][postal_code]") {
              msg = "Некорректный почтовый индекс.";
            } else if (stripeError.param === "payment_method_data[billing_details][address][country]") {
              msg = "Некорректная страна.";
            }
            break;
          default:
            msg = stripeError.message || msg;
        }
        setError(msg);
        toast.error(msg);
        return; // ВАЖНО: возвращаемся, не устанавливая lastPaymentIntentIdRef
      }

      // 3. Проверяем результат подтверждения
      if (!paymentIntent) {
        setError("Не получен результат подтверждения платежа.");
        toast.error("Ошибка: не получен результат подтверждения.");
        return; // ВАЖНО: возвращаемся, не устанавливая lastPaymentIntentIdRef
      }

      paymentIntentResult = paymentIntent; // Сохраняем результат

      // 4. Проверяем ошибки, возникшие уже после подтверждения (async)
      if (paymentIntent.last_payment_error) {
        console.error("Ошибка последнего платежа:", paymentIntent.last_payment_error);
        let msg = "Платёж отклонён.";
        switch (paymentIntent.last_payment_error.code) {
          case "card_declined":
            msg = "Карта отклонена банком.";
            break;
          case "expired_card":
            msg = "Срок действия карты истёк.";
            break;
          case "incorrect_cvc":
            msg = "Некорректный CVC/CVV код.";
            break;
          case "processing_error":
            msg = "Ошибка обработки платежа.";
            break;
          case "insufficient_funds":
            msg = "Недостаточно средств на карте.";
            break;
          case "invalid_cvc":
            msg = "Платёж отклонён. Карта заблокирована или не активна для онлайн-оплаты.";
            break;
          default:
            msg =
              paymentIntent.last_payment_error.message ||
              "Неизвестная ошибка при обработке платежа.";
        }
        setError(msg);
        toast.error(msg);
        return; // ВАЖНО: возвращаемся, не устанавливая lastPaymentIntentIdRef
      }

      // 5. Успешное подтверждение
      toast.success("Платёж успешно обработан!");
      console.log("Успешный PaymentIntent:", paymentIntent);
      lastPaymentIntentIdRef.current = piId; // Устанавливаем только при успехе
    } catch (error) {
      // 6. Обработка любых JS-исключений
      console.error("JS ошибка при оплате:", error);
      setError("Произошла ошибка при обработке платежа.");
      toast.error("Произошла ошибка.");
      // Не устанавливаем lastPaymentIntentIdRef при исключениях
    } finally {
      // 7. В любом случае (успех, ошибка Stripe, ошибка валидации, JS исключение), сбрасываем флаг
      setProcessing(false); // Используем setProcessing
      // ИСПРАВЛЕНИЕ: Очищаем lastPaymentIntentIdRef.current, если статус не 'succeeded'.
      // Это предотвращает блокировку повторной попытки после неудачной.
      // Проверяем статус из сохраненного результата
      const wasSuccessful = paymentIntentResult && paymentIntentResult.status === 'succeeded';
      if (!wasSuccessful) {
        lastPaymentIntentIdRef.current = null; // Сбрасываем, если неуспешно или была ошибка JS
      }
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

  if (!auction) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card">
          <div className="text-center py-8">Аукцион не найден</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Оплата аукциона
        </h2>

        <AuctionSummary auction={auction} />

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Страна оплаты
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="input input-bordered w-full"
            disabled={processing}
          >
            {COUNTRIES.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Данные карты
          </label>
          <div ref={cardContainerRef} className="border border-gray-300 rounded-md p-3" />
        </div>

        {error && (
          <div className="mt-4 bg-red-50 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={processing || !clientSecretRef.current}
          className={`btn btn-primary w-full mt-6 ${processing ? "loading" : ""}`}
        >
          {processing ? "Обработка..." : `Оплатить ${auction.currentPrice} ${auction.currency}`}
        </button>

        <Link
          to={`/auctions/${id}`}
          className="btn btn-secondary w-full mt-4 inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к аукциону
        </Link>
      </div>
    </div>
  );
} // Закрывающая скобка для компонента PaymentPage

export default PaymentPage;
