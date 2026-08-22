import { auctionsApi } from "@/api/auctions";
import { markErrorAsHandled } from "@/utils/errorHandler";
import type { AxiosError } from "axios";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import type { useNavigate } from "react-router-dom";

export const useAuctionActions = (auctionId: number | undefined, navigate: ReturnType<typeof useNavigate>) => {
  const handleDelete = useCallback(async () => {
    if (!auctionId) return;
    try {
      await auctionsApi.deleteAuction(auctionId);
      toast.success("Аукцион удалён");
      navigate("/");
    } catch (error) {
      toast.error("Не удалось удалить аукцион");
      // Помечаем ошибку как обработанную, чтобы избежать дублирования с глобальным interceptor'ом
      markErrorAsHandled(error as Error | AxiosError);
    }
  }, [auctionId, navigate]);

  const handleConfirmDelete = handleDelete;

  const handleEdit = useCallback(() => {
    if (!auctionId) return;
    navigate(`/auctions/${auctionId}/edit`);
  }, [auctionId, navigate]);

  const handlePayment = useCallback(() => {
    if (!auctionId) return;
    navigate(`/payment/${auctionId}`);
  }, [auctionId, navigate]);

  return {
    handleDelete,
    handleEdit,
    handlePayment,
    handleConfirmDelete,
  };
};
