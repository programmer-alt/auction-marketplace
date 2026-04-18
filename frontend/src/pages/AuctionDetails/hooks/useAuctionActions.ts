import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auctionsApi } from '../../../api/auctions';
import toast from 'react-hot-toast';

export const useAuctionActions = (auctionId: number | undefined, navigate: ReturnType<typeof useNavigate>) => {
  const handleDelete = useCallback(async () => {
    if (!auctionId) return;
    try {
      await auctionsApi.deleteAuction(auctionId);
      toast.success('Аукцион удалён');
      navigate('/');
    } catch {
      toast.error('Не удалось удалить аукцион');
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