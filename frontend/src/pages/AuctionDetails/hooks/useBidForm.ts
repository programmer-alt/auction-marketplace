import { useState, useCallback } from 'react';
import { bidsApi } from '../../../api/bids';
import toast from 'react-hot-toast';

export const useBidForm = (auctionId: number | undefined, currentPrice: number | undefined) => {
  const [bidAmount, setBidAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitBid = useCallback(async (amount: number) => {
    if (!auctionId || currentPrice === undefined) return false;
    if (amount <= currentPrice) {
      const message = `Ставка должна быть выше текущей цены (${currentPrice})`;
      toast.error(message);
      setError(message);
      return false;
    }
    setIsSubmitting(true);
    setError(null);
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
      const message = 'Введите корректную сумму';
      toast.error(message);
      setError(message);
      return;
    }
    setError(null);
    await submitBid(amount);
  }, [bidAmount, submitBid]);

  const validateAmount = useCallback((value: string) => {
    setBidAmount(value);
    const amount = parseFloat(value);
    if (isNaN(amount)) {
      setError('Введите число');
    } else if (currentPrice !== undefined && amount <= currentPrice) {
      setError(`Ставка должна быть выше ${currentPrice}`);
    } else {
      setError(null);
    }
  }, [currentPrice]);

  return {
    bidAmount,
    setBidAmount: validateAmount,
    isSubmitting,
    handleSubmit,
    submitBid,
    error,
  };
};