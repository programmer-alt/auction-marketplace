import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useStripe } from "@stripe/react-stripe-js";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentResult() {
  const [searchParams] = useSearchParams();
  const stripe = useStripe();

  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState<string>("");

  const paymentIntentId = searchParams.get("payment_intent");
  const redirectStatus = searchParams.get("redirect_status");

  useEffect(() => {
    if (!stripe) return;

    if (redirectStatus === "succeeded") {
      setStatus("success");
      setMessage("Платёж успешно подтверждён!");
      return;
    }

    if (redirectStatus === "failed") {
      setStatus("failed");
      setMessage("Платёж не прошёл. Попробуйте ещё раз.");
      return;
    }

    // Если redirect_status нет — проверяем PI вручную
    if (!paymentIntentId) {
      setStatus("failed");
      setMessage("Отсутствует информация о платеже.");
      return;
    }

    stripe
      .retrievePaymentIntent(paymentIntentId)
      .then(({ paymentIntent }) => {
        if (!paymentIntent) {
          setStatus("failed");
          setMessage("Не удалось получить информацию о платеже.");
          return;
        }

        switch (paymentIntent.status) {
          case "succeeded":
            setStatus("success");
            setMessage("Платёж успешно подтверждён!");
            break;
          case "processing":
            setMessage("Платёж обрабатывается. Мы уведомим вас о результате.");
            setStatus("success");
            break;
          case "requires_payment_method":
            setStatus("failed");
            setMessage("Платёж не прошёл. Попробуйте ещё раз.");
            break;
          default:
            setStatus("failed");
            setMessage(`Статус платежа: ${paymentIntent.status}`);
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("Ошибка при проверке статуса платежа.");
      });
  }, [stripe, redirectStatus, paymentIntentId]);

  if (status === "loading") {
    return (
      <div className="max-w-lg mx-auto">
        <div data-testid="payment-result-loading" className="card flex flex-col items-center py-12">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Проверяем статус платежа...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="max-w-lg mx-auto">
        <div data-testid="payment-result-success" className="card text-center">
          <div className="bg-green-100 p-4 rounded-full inline-block mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Оплата прошла успешно!</h1>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <Link to="/profile" className="btn-primary">
              Мои покупки
            </Link>
            <Link to="/auctions" className="btn-secondary">
              К аукционам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div data-testid="payment-result-failed" className="card text-center">
        <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
          <XCircle className="h-12 w-12 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Ошибка оплаты</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <Link to="/auctions" className="inline-flex items-center gap-2 text-gray-600 hover:text-primary-600">
          <ArrowLeft className="h-4 w-4" />
          Назад к аукционам
        </Link>
      </div>
    </div>
  );
}
