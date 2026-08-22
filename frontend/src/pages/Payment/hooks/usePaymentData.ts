import { auctionsApi } from "@/api/auctions";
import { type User, isApiError, isApiSuccess } from "@/types";
import { handleBusinessLogicError, handleError } from "@/utils/universalErrorHandler";
import { useEffect, useState } from "react";

export const usePaymentData = (id: string | undefined, user: User | null) => {
  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const auctionIdRaw = id;
    const auctionId = Number.isNaN(Number(auctionIdRaw)) ? undefined : Number(auctionIdRaw);

    if (!auctionId) {
      handleBusinessLogicError(new Error("Некорректный ID аукциона"), {
        auctionIdRaw,
        auctionId: undefined,
        context: "payment-authorization",
      });
      setLoading(false);
      return;
    }

    const fetchAuction = async () => {
      try {
        setLoading(true);
        const data = await auctionsApi.getAuctionById(auctionId);

        if (isApiSuccess(data) && data.data) {
          const auctionData = data.data;

          // Проверяем, что пользователь является победителем аукциона
          // Используем winnerId как основной способ, но проверяем winner.id как резервный вариант
          const actualWinnerId = auctionData.winnerId ?? auctionData.winner?.id;

          if (actualWinnerId !== user.id) {
            handleBusinessLogicError(new Error("Только победитель аукциона может произвести оплату"), {
              userId: user.id,
              winnerId: actualWinnerId,
              auctionIdRaw,
              auctionId,
              context: "payment-authorization",
            });
            return;
          }

          // Проверяем статус аукциона
          if (auctionData.status !== "COMPLETED") {
            handleBusinessLogicError(new Error("Оплата возможна только за завершенные аукционы"), {
              status: auctionData.status,
              auctionIdRaw,
              auctionId,
              context: "payment-status-check",
            });
            return;
          }

          setAuction(data.data);
        } else if (isApiError(data)) {
          // Теперь мы уверены, что data - это ApiError, и свойство error существует
          handleBusinessLogicError(new Error(data.error || "Аукцион не найден"), {
            auctionIdRaw,
            auctionId,
            context: "auction-not-found",
          });
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных аукциона для оплаты:", error);
        handleError(error as any, "Ошибка при загрузке данных аукциона", undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchAuction();
  }, [id, user]);

  return { auction, loading };
};
