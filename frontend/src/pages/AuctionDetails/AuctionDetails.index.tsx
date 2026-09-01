import React from "react";

import { useAuthStore } from "@/store/auth.store";
import { handleBusinessLogicError } from "@/utils/universalErrorHandler";
import { useNavigate, useParams } from "react-router-dom";
import AuctionActions from "./components/AuctionActions";
import AuctionDetailsInfo from "./components/AuctionDetailsInfo";
import AuctionHeader from "./components/AuctionHeader";
import AuctionImage from "./components/AuctionImage";
import BidForm from "./components/BidForm";
import BidHistory from "./components/BidHistory";
import { useAuctionActions } from "./hooks/useAuctionActions";
import { useAuctionData } from "./hooks/useAuctionData";
import { useAuctionState } from "./hooks/useAuctionState";
import { useBidForm } from "./hooks/useBidForm";

const LoadingSkeleton = () => (
  <div className="max-w-4xl mx-auto">
    <div className="card animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  </div>
);

const NotFound = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    handleBusinessLogicError(new Error("Аукцион не найден"), { context: "auction-not-found-component" });
    navigate("/");
  }, [navigate]);
  return null;
};

export default function AuctionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const { auction, bids, loading, refresh } = useAuctionData(id);
  const { bidAmount, setBidAmount, isSubmitting, submitBid } = useBidForm(
    auction?.id,
    auction?.currentPrice ?? undefined,
  );
  const { handleDelete, handleEdit, handlePayment, handleComplete, handleConfirmDelete } = useAuctionActions(
    auction?.id,
    navigate,
  );

  // Используем хук для вычисления производных состояний
  const {
    isOwner,
    isActive,
    isEnded,
    isTimeEnded,
    statusInfo,
    showBidForm,
    showLoginPrompt,
    showOwnerMessage,
    showAuctionActions,
  } = useAuctionState(auction, user, isAuthenticated);

  const handleBidSubmit = async (amount: number): Promise<boolean> => {
    const success = await submitBid(amount);
    if (success && id) {
      // Обновляем данные аукциона после успешной ставки
      await refresh();
    }
    return success;
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!auction) {
    return <NotFound />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <AuctionHeader auction={auction} statusInfo={statusInfo} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          <AuctionImage imageUrl={auction.imageUrl} title={auction.title} />
          <AuctionDetailsInfo auction={auction} isEnded={isEnded} />
          <BidHistory bids={bids} />
        </div>

        {/* Боковая панель */}
        <div>
          {showBidForm && (
            <BidForm
              auction={auction}
              onSubmit={handleBidSubmit}
              isSubmitting={isSubmitting}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
            />
          )}
          {showLoginPrompt && (
            <div className="card text-center">
              <p className="text-gray-600 mb-4">Войдите, чтобы делать ставки</p>
              <button type="button" onClick={() => navigate("/login")} className="btn-primary w-full">
                Войти
              </button>
            </div>
          )}
          {showOwnerMessage && (
            <div className="card text-center">
              <p className="text-gray-500">Это ваш аукцион</p>
              <p className="text-sm text-gray-400 mt-1">Ожидайте ставок от участников</p>
            </div>
          )}

          {/* Действия с аукционом */}
          {showAuctionActions && (
            <div className="mt-6">
              <AuctionActions
                auction={auction}
                user={user}
                isOwner={isOwner}
                isActive={isActive}
                isTimeEnded={isTimeEnded}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onPayment={handlePayment}
                onComplete={handleComplete}
                onConfirmDelete={handleConfirmDelete}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
