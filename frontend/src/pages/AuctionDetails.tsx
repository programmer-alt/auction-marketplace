import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useAuctionData } from './AuctionDetailsPage/hooks/useAuctionData';
import { useBidForm } from './AuctionDetailsPage/hooks/useBidForm';
import { useAuctionActions } from './AuctionDetailsPage/hooks/useAuctionActions';
import AuctionHeader from './AuctionDetailsPage/components/AuctionHeader';
import AuctionImage from './AuctionDetailsPage/components/AuctionImage';
import AuctionDetailsInfo from './AuctionDetailsPage/components/AuctionDetailsInfo';
import BidHistory from './AuctionDetailsPage/components/BidHistory';
import BidForm from './AuctionDetailsPage/components/BidForm';
import AuctionActions from './AuctionDetailsPage/components/AuctionActions';
import { Auction } from '../types';
import toast from 'react-hot-toast';
import { useStatusBadge } from '../hooks/useStatusBadge';

const LoadingSkeleton = () => (
  <div className="max-w-4xl mx-auto">
    <div className="card animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
    </div>
  </div>
);

const NotFound = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    toast.error('Аукцион не найден');
    navigate('/');
  }, [navigate]);
  return null;
};

export default function AuctionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const { auction, bids, loading, refresh } = useAuctionData(id);
  const { bidAmount, setBidAmount, isSubmitting, submitBid, error } = useBidForm(
    auction?.id,
    auction?.currentPrice
  );
  const { handleDelete, handleEdit, handlePayment, handleConfirmDelete } = useAuctionActions(
    auction?.id,
    navigate
  );

  const { getStatusBadge } = useStatusBadge();

  const { isOwner, isActive, isEnded, statusInfo } = useMemo(() => {
    if (!auction) {
      return { isOwner: false, isActive: false, isEnded: false, statusInfo: { label: '', cls: '' } };
    }
    return {
      isOwner: user?.id === auction.sellerId,
      isActive: auction.status === 'ACTIVE',
      isEnded: new Date(auction.endsAt) < new Date(),
      statusInfo: getStatusBadge(auction.status),
    };
  }, [auction, user, getStatusBadge]);

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
          {isAuthenticated && isActive && !isEnded && !isOwner ? (
            <BidForm
              auction={auction}
              onSubmit={handleBidSubmit}
              isSubmitting={isSubmitting}
              bidAmount={bidAmount}
              setBidAmount={setBidAmount}
              error={error}
            />
          ) : !isAuthenticated && isActive && !isEnded ? (
            <div className="card text-center">
              <p className="text-gray-600 mb-4">Войдите, чтобы делать ставки</p>
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full"
              >
                Войти
              </button>
            </div>
          ) : isOwner && isActive ? (
            <div className="card text-center">
              <p className="text-gray-500">Это ваш аукцион</p>
              <p className="text-sm text-gray-400 mt-1">
                Ожидайте ставок от участников
              </p>
            </div>
          ) : null}

          {/* Действия с аукционом */}
          <div className="mt-6">
            <AuctionActions
              auction={auction}
              user={user}
              isOwner={isOwner}
              isActive={isActive}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPayment={handlePayment}
              onConfirmDelete={handleConfirmDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}