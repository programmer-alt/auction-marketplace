import { useState, useCallback } from 'react';
import { bidsApi } from '../../../api/bids';
import toast from 'react-hot-toast';

export const useBidForm = (auctionId: number | undefined, currentPrice: number | undefined) => {
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitBid = useCallback(async (amount: number) => {
    if (!auctionId || !currentPrice) return false;
    if (amount <= currentPrice) {
      toast.error('Ставка должна быть выше текущей цены');
      return false;
    }
    setIsSubmitting(true);
    try {
      await bidsApi.createBid(auctionId, { amount });
      toast.success('Ставка размещена!');
      setBidAmount('');
      return true;
    } catch {
      toast.error('Не удалось разместить ставку');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [auctionId, currentPrice]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(bidAmount);
    if (isNaN(amount)) {
      toast.error('Введите корректную сумму');
      return;
    }
    await submitBid(amount);
  }, [bidAmount, submitBid]);

  return {
    bidAmount,
    setBidAmount,
    isSubmitting,
    handleSubmit,
    submitBid,
  };
};